import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface ResendNotificationInput {
    announcement_id: string;
}

Deno.serve(async (req: Request) => {
    try {
        const { announcement_id }: ResendNotificationInput = await req.json();

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // 1. Validate input
        if (!announcement_id) {
            return new Response(
                JSON.stringify({ error: 'Invalid input: announcement_id required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // 2. Fetch announcement details
        const { data: announcement, error: fetchError } = await supabase
            .from('announcements')
            .select('*')
            .eq('id', announcement_id)
            .single();

        if (fetchError || !announcement) {
            return new Response(
                JSON.stringify({ error: 'Announcement not found' }),
                { status: 404, headers: { 'Content-Type': 'application/json' } }
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
            // Get all students in class
            const { data: students } = await supabase
                .from('student')
                .select('user_id')
                .eq('class_instance_id', announcement.class_instance_id);
            userIds = students?.map(s => s.user_id).filter(Boolean) || [];
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
                JSON.stringify({ success: true, notified: 0, message: 'No users to notify' }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // 4. Send notifications
        const notificationUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`;
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

        const response = await fetch(notificationUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader,
            },
            body: JSON.stringify({
                event: 'announcement_reminder',
                targets: { user_ids: userIds },
                payload: {
                    title: `🔔 Reminder: ${emoji} ${prefix}${announcement.title}`,
                    body: `${announcement.message} 📣`,
                    data: {
                        type: 'announcement',
                        announcement_id: announcement.id,
                        priority: announcement.priority,
                        is_reminder: true,
                    },
                },
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Notification send failed:', errorText);
            return new Response(
                JSON.stringify({ error: 'Failed to send notifications', details: errorText }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // 5. Return success
        return new Response(
            JSON.stringify({
                success: true,
                notified: userIds.length,
                message: `Reminder sent to ${userIds.length} user(s)`,
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
