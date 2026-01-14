import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100;

interface NotificationRequest {
    event: string;
    targets: {
        user_ids: string[];
    };
    payload: {
        title: string;
        body: string;
        data?: Record<string, any>;
    };
}

interface ExpoReceipt {
    status: string;
    details?: {
        error?: string;
    };
}

Deno.serve(async (req: Request) => {
    try {
        const { event, targets, payload }: NotificationRequest = await req.json();

        // Validate input
        if (!event || !targets?.user_ids || !payload?.title || !payload?.body) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Create Supabase client with service role (bypasses RLS)
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // Check if event is enabled (optional kill-switch)
        const { data: eventConfig } = await supabase
            .from('notification_events')
            .select('enabled')
            .eq('event', event)
            .single();

        if (eventConfig && !eventConfig.enabled) {
            console.log(`Event ${event} is disabled, skipping notification`);
            return new Response(
                JSON.stringify({ skipped: true, reason: 'Event disabled' }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Fetch tokens for target users (service role can read all)
        const { data: tokens, error } = await supabase
            .from('push_notification_tokens')
            .select('id, token, user_id')
            .in('user_id', targets.user_ids);

        if (error) {
            console.error('Error fetching tokens:', error);
            return new Response(
                JSON.stringify({ error: 'Failed to fetch tokens' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        if (!tokens || tokens.length === 0) {
            console.log('No tokens found for target users');
            return new Response(
                JSON.stringify({ sent: 0, message: 'No tokens found' }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Batch tokens (Expo limit: 100 per request)
        const batches = [];
        for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
            batches.push(tokens.slice(i, i + BATCH_SIZE));
        }

        let successCount = 0;
        let failedCount = 0;
        const invalidTokenIds: string[] = [];
        const logs: any[] = [];

        // Send batches to Expo Push API
        for (const batch of batches) {
            const messages = batch.map(t => ({
                to: t.token,
                sound: 'default' as const,
                title: payload.title,
                body: payload.body,
                data: payload.data || {},
            }));

            try {
                const response = await fetch(EXPO_PUSH_URL, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(messages),
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Expo API error:', errorText);
                    failedCount += batch.length;

                    // Log failure for whole batch
                    batch.forEach(tokenObj => {
                        logs.push({
                            event,
                            user_id: tokenObj.user_id, // Need to fetch user_id in tokens query
                            title: payload.title,
                            body: payload.body,
                            data: payload.data,
                            status: 'failed',
                            error: `Expo API Error: ${response.status}`
                        });
                    });
                    continue;
                }

                const result = await response.json();

                // Process receipts
                if (result.data) {
                    result.data.forEach((receipt: ExpoReceipt, index: number) => {
                        const tokenObj = batch[index];

                        if (receipt.status === 'ok') {
                            successCount++;
                            logs.push({
                                event,
                                user_id: tokenObj.user_id,
                                title: payload.title,
                                body: payload.body,
                                data: payload.data,
                                status: 'sent'
                            });
                        } else {
                            failedCount++;
                            console.error('Push failed:', receipt);

                            logs.push({
                                event,
                                user_id: tokenObj.user_id,
                                title: payload.title,
                                body: payload.body,
                                data: payload.data,
                                status: 'failed',
                                error: receipt.details?.error || 'Unknown error'
                            });

                            // Mark invalid tokens for cleanup
                            if (receipt.details?.error === 'DeviceNotRegistered' ||
                                receipt.details?.error === 'InvalidCredentials') {
                                invalidTokenIds.push(tokenObj.id);
                            }
                        }
                    });
                }
            } catch (err) {
                console.error('Batch send failed:', err);
                failedCount += batch.length;
                batch.forEach(tokenObj => {
                    logs.push({
                        event,
                        user_id: tokenObj.user_id,
                        title: payload.title,
                        body: payload.body,
                        data: payload.data,
                        status: 'failed',
                        error: (err as Error).message
                    });
                });
            }
        }

        // Save logs to database (async, don't block response too much)
        if (logs.length > 0) {
            await supabase.from('notification_logs').insert(logs);
        }

        // Cleanup invalid tokens
        if (invalidTokenIds.length > 0) {
            console.log(`Cleaning up ${invalidTokenIds.length} invalid tokens`);
            await supabase
                .from('push_notification_tokens')
                .delete()
                .in('id', invalidTokenIds);
        }

        return new Response(
            JSON.stringify({
                success: successCount,
                failed: failedCount,
                cleaned: invalidTokenIds.length
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
