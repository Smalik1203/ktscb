/**
 * Queue Notification Edge Function
 * 
 * Adds notifications to the queue for background processing.
 * Use this instead of send-notification for large audiences (100+ users).
 * 
 * Benefits:
 * - No timeout issues for large sends
 * - Progress tracking
 * - Automatic retries
 * - Priority support
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface QueueRequest {
    event: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    targets: {
        user_ids?: string[];
        school_code?: string;
    };
    priority?: number; // 1-10, lower = higher priority
}

Deno.serve(async (req: Request) => {
    try {
        const request: QueueRequest = await req.json();

        // Validate input
        if (!request.event || !request.title || !request.body) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields: event, title, body' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        if (!request.targets?.user_ids && !request.targets?.school_code) {
            return new Response(
                JSON.stringify({ error: 'Must provide either user_ids or school_code in targets' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // Use RPC to enqueue
        const { data: queueId, error } = await supabase.rpc('enqueue_notification', {
            p_event: request.event,
            p_title: request.title,
            p_body: request.body,
            p_data: request.data || {},
            p_school_code: request.targets.school_code || null,
            p_user_ids: request.targets.user_ids || null,
            p_priority: request.priority || 5
        });

        if (error) {
            console.error('Failed to enqueue notification:', error);
            return new Response(
                JSON.stringify({ error: error.message }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Trigger immediate processing (non-blocking)
        queueMicrotask(async () => {
            try {
                const processUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-notification-queue`;
                await fetch(processUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
                    },
                    body: JSON.stringify({ queue_id: queueId })
                });
            } catch (err) {
                console.error('Failed to trigger queue processing:', err);
            }
        });

        return new Response(
            JSON.stringify({
                success: true,
                queue_id: queueId,
                message: 'Notification queued for delivery'
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Unexpected error:', error);
        return new Response(
            JSON.stringify({ error: (error as Error).message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
});
