/**
 * Send Fee Notification Edge Function
 * 
 * Handles all fee-related notifications:
 * - invoice_generated: When a new invoice is created
 * - payment_received: When a payment is recorded
 * - payment_reminder: Manual reminder for unpaid invoices
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

type NotificationType = 'invoice_generated' | 'payment_received' | 'payment_reminder';

interface FeeNotificationInput {
    type: NotificationType;
    invoice_id: string;
    // Optional: for payment_received
    payment_amount?: number;
    // Optional: for invoice_generated (bulk)
    invoice_ids?: string[];
}

const formatAmount = (amount: number) =>
    `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const formatDate = (dateString: string) => {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch {
        return dateString;
    }
};

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonResponse = (body: object, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    try {
        let input: FeeNotificationInput;
        try {
            input = await req.json();
        } catch {
            return jsonResponse({ error: 'Invalid JSON body' }, 400);
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (!supabaseUrl || !serviceRoleKey) {
            console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
            return jsonResponse({ error: 'Server configuration error' }, 500);
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey);

        // Validate input
        if (!input.type) {
            return jsonResponse({ error: 'Missing required field: type' }, 400);
        }

        const authHeader = `Bearer ${serviceRoleKey}`;

        // Handle bulk invoice generation
        if (input.type === 'invoice_generated' && input.invoice_ids && input.invoice_ids.length > 0) {
            // Fetch all invoices with student info
            const { data: invoices, error: invoicesError } = await supabase
                .from('fee_invoices')
                .select(`
                    id,
                    student_id,
                    total_amount,
                    due_date,
                    billing_period,
                    student:student_id(id, auth_user_id, full_name)
                `)
                .in('id', input.invoice_ids);

            if (invoicesError || !invoices || invoices.length === 0) {
                console.warn('No invoices found for notification');
                return jsonResponse({ success: true, notified: 0 }, 200);
            }

            // Get user IDs for students with accounts (auth_user_id = users.id for push targets)
            const userIds = invoices
                .map(inv => (inv.student as { auth_user_id?: string } | null)?.auth_user_id)
                .filter(Boolean) as string[];

            if (userIds.length === 0) {
                return jsonResponse({ success: true, notified: 0, message: 'No student accounts found' }, 200);
            }

            // Send batch notification
            const firstInvoice = invoices[0];
            const totalAmount = invoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);
            const avgAmount = totalAmount / invoices.length;

            const notificationUrl = userIds.length > 50 
                ? `${supabaseUrl}/functions/v1/queue-notification`
                : `${supabaseUrl}/functions/v1/send-notification`;

            const payload = {
                event: 'fee_invoice_generated',
                title: '💰 Fee Invoice Generated',
                body: `New invoice for ${firstInvoice.billing_period} - ${formatAmount(avgAmount)}. Due: ${formatDate(firstInvoice.due_date || '')}`,
                data: {
                    type: 'fee_invoice',
                    billing_period: firstInvoice.billing_period,
                },
            };

            if (userIds.length > 50) {
                await fetch(notificationUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
                    body: JSON.stringify({ ...payload, targets: { user_ids: userIds } }),
                });
            } else {
                await fetch(notificationUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
                    body: JSON.stringify({
                        event: payload.event,
                        targets: { user_ids: userIds },
                        payload: { title: payload.title, body: payload.body, data: payload.data },
                    }),
                });
            }

            return jsonResponse({ success: true, notified: userIds.length }, 200);
        }

        // Single invoice operations
        if (!input.invoice_id) {
            return jsonResponse({ error: 'Missing required field: invoice_id' }, 400);
        }

        // Fetch invoice with student info (student table has auth_user_id, not user_id)
        const { data: invoice, error: invoiceError } = await supabase
            .from('fee_invoices')
            .select(`
                id,
                student_id,
                total_amount,
                paid_amount,
                due_date,
                billing_period,
                status,
                student:student_id(id, auth_user_id, full_name)
            `)
            .eq('id', input.invoice_id)
            .single();

        if (invoiceError || !invoice) {
            const dbMessage = invoiceError?.message ?? (invoiceError as any)?.details ?? 'unknown';
            console.error('Invoice fetch failed', { invoice_id: input.invoice_id, error: invoiceError });
            return jsonResponse({ error: 'Invoice not found', details: String(dbMessage) }, 404);
        }

        const student = invoice.student as { auth_user_id?: string; full_name?: string } | null;
        const targetUserId = student?.auth_user_id;
        if (!targetUserId) {
            return jsonResponse({ success: true, notified: 0, message: 'Student has no user account' }, 200);
        }

        let title: string;
        let body: string;
        let event: string;

        const balance = Number(invoice.total_amount) - Number(invoice.paid_amount);

        switch (input.type) {
            case 'invoice_generated':
                event = 'fee_invoice_generated';
                title = '💰 Fee Invoice Generated';
                body = `New invoice for ${invoice.billing_period} - ${formatAmount(invoice.total_amount)}. Due: ${formatDate(invoice.due_date || '')}`;
                break;

            case 'payment_received':
                event = 'fee_payment_received';
                const paymentAmount = input.payment_amount || 0;
                title = '✅ Payment Received!';
                body = `Payment of ${formatAmount(paymentAmount)} recorded. ${balance > 0 ? `Remaining: ${formatAmount(balance)}` : 'Invoice fully paid! 🎉'}`;
                break;

            case 'payment_reminder':
                event = 'fee_payment_reminder';
                const daysOverdue = invoice.due_date 
                    ? Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24))
                    : 0;
                
                if (daysOverdue > 0) {
                    title = '⚠️ Payment Overdue';
                    body = `Fee payment of ${formatAmount(balance)} is ${daysOverdue} days overdue. Please pay immediately.`;
                } else {
                    title = '⏰ Payment Reminder';
                    body = `Fee payment of ${formatAmount(balance)} is due${invoice.due_date ? ` on ${formatDate(invoice.due_date)}` : ''}. Please pay soon.`;
                }
                break;

            default:
                return jsonResponse({ error: 'Invalid notification type' }, 400);
        }

        // Send notification
        const notificationUrl = `${supabaseUrl}/functions/v1/send-notification`;
        
        await fetch(notificationUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader,
            },
            body: JSON.stringify({
                event,
                targets: { user_ids: [targetUserId] },
                payload: {
                    title,
                    body,
                    data: {
                        type: 'fee',
                        invoice_id: invoice.id,
                        notification_type: input.type,
                    },
                },
            }),
        });

        return jsonResponse({ success: true, notified: 1 }, 200);
    } catch (error) {
        console.error('Unexpected error:', error);
        return jsonResponse({ error: (error as Error).message }, 500);
    }
});
