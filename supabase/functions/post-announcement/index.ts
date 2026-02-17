import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface AnnouncementInput {
    title: string;
    message: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    target_type: 'all' | 'class' | 'role';
    class_instance_id?: string;
    target_role?: string;
    school_code: string;
    created_by: string;
    image_url?: string;
}

Deno.serve(async (req: Request) => {
    try {
        const { announcement }: { announcement: AnnouncementInput } = await req.json();

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // 1. Validate input
        if (!announcement || !announcement.title || !announcement.message || !announcement.school_code) {
            return new Response(
                JSON.stringify({ error: 'Invalid input: title, message, and school_code required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // 2. Insert announcement into database
        const { data: insertedAnnouncement, error: insertError } = await supabase
            .from('announcements')
            .insert({
                title: announcement.title,
                message: announcement.message,
                priority: announcement.priority || 'medium',
                target_type: announcement.target_type || 'all',
                class_instance_id: announcement.class_instance_id,
                target_role: announcement.target_role,
                school_code: announcement.school_code,
                created_by: announcement.created_by,
                image_url: announcement.image_url || null,
            })
            .select('id, title, message, priority, target_type, class_instance_id, target_role, school_code, created_by, created_at, updated_at, pinned, likes_count, views_count, image_url')
            .single();

        if (insertError) {
            return new Response(
                JSON.stringify({ error: insertError.message }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // 3. Get target users based on target_type
        let userIds: string[] = [];

        if (announcement.target_type === 'all') {
            // Get all users in school
            const { data: users } = await supabase
                .from('users')
                .select('id')
                .eq('school_code', announcement.school_code);
            userIds = users?.map(u => u.id) || [];
        } else if (announcement.target_type === 'class' && announcement.class_instance_id) {
            // Get all students in class (student table has auth_user_id, not user_id)
            const { data: students } = await supabase
                .from('student')
                .select('auth_user_id')
                .eq('class_instance_id', announcement.class_instance_id);
            userIds = students?.map(s => s.auth_user_id).filter(Boolean) || [];
        } else if (announcement.target_type === 'role' && announcement.target_role) {
            // Get all users with specific role
            const { data: users } = await supabase
                .from('users')
                .select('id')
                .eq('school_code', announcement.school_code)
                .eq('role', announcement.target_role);
            userIds = users?.map(u => u.id) || [];
        }

        if (userIds.length === 0) {
            console.warn('No target users found');
            return new Response(
                JSON.stringify({ success: true, data: insertedAnnouncement, notified: 0 }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // 4. Trigger notifications (async, server-controlled)
        // Use queue for large audiences (50+ users), direct send for small
        queueMicrotask(async () => {
            try {
                const authHeader = `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`;

                // Choose emoji based on priority
                let emoji = '📢';
                let prefix = '';

                switch (announcement.priority) {
                    case 'urgent':
                        emoji = '🚨';
                        prefix = 'URGENT: ';
                        break;
                    case 'high':
                        emoji = '⚠️';
                        prefix = 'Important: ';
                        break;
                    case 'medium':
                        emoji = '📢';
                        break;
                    case 'low':
                        emoji = 'ℹ️';
                        break;
                }

                const notificationPayload = {
                    event: 'announcement_posted',
                    title: `${emoji} ${prefix}${announcement.title}`,
                    body: `${announcement.message} 📣`,
                    data: {
                        type: 'announcement',
                        announcement_id: insertedAnnouncement.id,
                        priority: announcement.priority,
                    },
                };

                // Use queue for large audiences, direct send for small
                if (userIds.length > 50) {
                    // Queue for background processing
                    const queueUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/queue-notification`;
                    await fetch(queueUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': authHeader,
                        },
                        body: JSON.stringify({
                            ...notificationPayload,
                            targets: { user_ids: userIds },
                            priority: announcement.priority === 'urgent' ? 1 : 
                                     announcement.priority === 'high' ? 3 : 5
                        }),
                    });
                    console.log(`Queued notification for ${userIds.length} users`);
                } else {
                    // Direct send for small audiences
                    const notificationUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`;
                    await fetch(notificationUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': authHeader,
                        },
                        body: JSON.stringify({
                            event: notificationPayload.event,
                            targets: { user_ids: userIds },
                            payload: {
                                title: notificationPayload.title,
                                body: notificationPayload.body,
                                data: notificationPayload.data,
                            },
                        }),
                    });
                }
            } catch (err) {
                console.error('Notification trigger failed:', err);
            }
        });

        // 5. Return immediately
        return new Response(
            JSON.stringify({
                success: true,
                data: insertedAnnouncement,
                notified: userIds.length,
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
