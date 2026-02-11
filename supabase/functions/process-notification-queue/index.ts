/**
 * Process Notification Queue Worker
 * 
 * Background worker that processes queued notifications in batches.
 * Can be triggered by:
 * - Direct invocation with queue_id
 * - Cron schedule (processes oldest pending)
 * 
 * Handles:
 * - Batch processing (500 users at a time)
 * - Expo Push API batching (100 per request)
 * - Progress tracking
 * - Error handling and retries
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 500;      // Users per worker invocation
const EXPO_BATCH_SIZE = 100; // Expo's limit per request

interface QueueJob {
    id: string;
    event: string;
    title: string;
    body: string;
    data: Record<string, unknown>;
    school_code: string | null;
    target_user_ids: string[] | null;
    status: string;
    total_recipients: number;
    processed_count: number;
    success_count: number;
    failed_count: number;
    retry_count: number;
    max_retries: number;
}

interface TokenRecord {
    user_id: string;
    token: string;
}

Deno.serve(async (req: Request) => {
    const startTime = Date.now();
    
    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        let queueId: string | null = null;

        // Check if specific queue_id was provided
        try {
            const body = await req.json();
            queueId = body.queue_id;
        } catch {
            // No body or invalid JSON - will process next pending
        }

        // Get job to process
        let job: QueueJob | null = null;

        if (queueId) {
            // Process specific job
            const { data } = await supabase
                .from('notification_queue')
                .select('*')
                .eq('id', queueId)
                .in('status', ['pending', 'processing'])
                .single();
            job = data;
        } else {
            // Get next pending job (by priority, then age)
            const { data } = await supabase
                .from('notification_queue')
                .select('*')
                .eq('status', 'pending')
                .order('priority', { ascending: true })
                .order('created_at', { ascending: true })
                .limit(1)
                .single();
            job = data;
        }

        if (!job) {
            return new Response(
                JSON.stringify({ idle: true, message: 'No pending jobs' }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Mark as processing
        await supabase
            .from('notification_queue')
            .update({ 
                status: 'processing',
                started_at: job.started_at || new Date().toISOString()
            })
            .eq('id', job.id);

        console.log(`Processing job ${job.id}: ${job.event} (${job.processed_count}/${job.total_recipients})`);

        // Get batch of tokens
        const { data: tokens, error: tokenError } = await supabase
            .rpc('get_notification_batch', {
                p_queue_id: job.id,
                p_batch_size: BATCH_SIZE
            });

        if (tokenError) {
            console.error('Failed to get tokens:', tokenError);
            await supabase
                .from('notification_queue')
                .update({ 
                    status: 'failed',
                    last_error: tokenError.message
                })
                .eq('id', job.id);
            
            return new Response(
                JSON.stringify({ error: tokenError.message }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        if (!tokens || tokens.length === 0) {
            // No more tokens to process - mark complete
            await supabase
                .from('notification_queue')
                .update({ 
                    status: 'completed',
                    completed_at: new Date().toISOString()
                })
                .eq('id', job.id);

            return new Response(
                JSON.stringify({ 
                    completed: true, 
                    job_id: job.id,
                    total_success: job.success_count,
                    total_failed: job.failed_count
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Process tokens in Expo batches
        let successCount = 0;
        let failedCount = 0;
        const logs: Array<{
            event: string;
            user_id: string;
            title: string;
            body: string;
            data: Record<string, unknown>;
            status: string;
            error?: string;
        }> = [];

        for (let i = 0; i < tokens.length; i += EXPO_BATCH_SIZE) {
            const batch = tokens.slice(i, i + EXPO_BATCH_SIZE) as TokenRecord[];
            
            const messages = batch.map(t => ({
                to: t.token,
                sound: 'default' as const,
                title: job!.title,
                body: job!.body,
                data: job!.data || {},
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
                    batch.forEach(t => {
                        logs.push({
                            event: job!.event,
                            user_id: t.user_id,
                            title: job!.title,
                            body: job!.body,
                            data: job!.data,
                            status: 'failed',
                            error: `Expo API Error: ${response.status}`
                        });
                    });
                    continue;
                }

                const result = await response.json();

                if (result.data) {
                    result.data.forEach((receipt: { status: string; details?: { error?: string } }, index: number) => {
                        const tokenRecord = batch[index];
                        
                        if (receipt.status === 'ok') {
                            successCount++;
                            logs.push({
                                event: job!.event,
                                user_id: tokenRecord.user_id,
                                title: job!.title,
                                body: job!.body,
                                data: job!.data,
                                status: 'sent'
                            });
                        } else {
                            failedCount++;
                            logs.push({
                                event: job!.event,
                                user_id: tokenRecord.user_id,
                                title: job!.title,
                                body: job!.body,
                                data: job!.data,
                                status: 'failed',
                                error: receipt.details?.error || 'Unknown error'
                            });

                            // Clean up invalid tokens
                            if (receipt.details?.error === 'DeviceNotRegistered' ||
                                receipt.details?.error === 'InvalidCredentials') {
                                supabase
                                    .from('push_notification_tokens')
                                    .delete()
                                    .eq('token', tokenRecord.token)
                                    .then(() => {
                                        console.log(`Cleaned up invalid token for user ${tokenRecord.user_id}`);
                                    });
                            }
                        }
                    });
                }
            } catch (err) {
                console.error('Batch send failed:', err);
                failedCount += batch.length;
                batch.forEach(t => {
                    logs.push({
                        event: job!.event,
                        user_id: t.user_id,
                        title: job!.title,
                        body: job!.body,
                        data: job!.data,
                        status: 'failed',
                        error: (err as Error).message
                    });
                });
            }
        }

        // Save logs
        if (logs.length > 0) {
            await supabase.from('notification_logs').insert(logs);
        }

        // Update progress
        await supabase.rpc('update_queue_progress', {
            p_queue_id: job.id,
            p_processed: tokens.length,
            p_success: successCount,
            p_failed: failedCount
        });

        // Check if more processing needed
        // The RPC now tracks batch_offset separately - refetch to check status
        const { data: updatedJob } = await supabase
            .from('notification_queue')
            .select('status, batch_offset, total_recipients')
            .eq('id', job.id)
            .single();
        
        const hasMore = updatedJob?.status === 'pending';

        // Trigger next batch if more to process (single call, not recursive chain)
        // pg_cron cleanup job handles stuck jobs as backup
        if (hasMore) {
            try {
                const selfUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-notification-queue`;
                // Fire and don't wait - let it process independently
                fetch(selfUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
                    },
                    body: JSON.stringify({ queue_id: job.id })
                }).catch(err => console.error('Failed to trigger next batch:', err));
            } catch (err) {
                console.error('Failed to trigger next batch:', err);
                // pg_cron will pick up the job on next run
            }
        }

        const elapsed = Date.now() - startTime;
        console.log(`Processed ${tokens.length} tokens in ${elapsed}ms (${successCount} success, ${failedCount} failed)`);

        return new Response(
            JSON.stringify({
                job_id: job.id,
                batch_processed: tokens.length,
                batch_success: successCount,
                batch_failed: failedCount,
                batch_offset: updatedJob?.batch_offset || 0,
                total_recipients: job.total_recipients,
                has_more: hasMore,
                elapsed_ms: elapsed
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
