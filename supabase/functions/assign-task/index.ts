import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface TaskInput {
    title: string;
    description: string;
    due_date: string;
    class_instance_id: string;
    subject?: string;
    created_by: string;
    school_code: string;
}

Deno.serve(async (req: Request) => {
    try {
        const { task }: { task: TaskInput } = await req.json();

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // 1. Validate input
        if (!task || !task.title || !task.class_instance_id || !task.due_date) {
            return new Response(
                JSON.stringify({ error: 'Invalid input: title, class_instance_id, and due_date required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // 2. Insert task into database
        const { data: insertedTask, error: insertError } = await supabase
            .from('tasks')
            .insert({
                title: task.title,
                description: task.description,
                due_date: task.due_date,
                class_instance_id: task.class_instance_id,
                subject: task.subject,
                created_by: task.created_by,
                school_code: task.school_code,
                status: 'pending',
            })
            .select('id, school_code, academic_year_id, class_instance_id, subject_id, title, description, priority, assigned_date, due_date, max_marks, instructions, attachments, is_active, created_by, created_at, updated_at')
            .single();

        if (insertError) {
            return new Response(
                JSON.stringify({ error: insertError.message }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // 3. Get all students in the class
        const { data: students, error: studentsError } = await supabase
            .from('student')
            .select('user_id')
            .eq('class_instance_id', task.class_instance_id);

        if (studentsError || !students || students.length === 0) {
            console.warn('No students found for class:', task.class_instance_id);
            return new Response(
                JSON.stringify({ success: true, data: insertedTask, notified: 0 }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // 4. Send notifications (fire-and-forget)
        const authHeader = `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`;
        const userIds = students.map(s => s.user_id).filter(Boolean) as string[];

        if (userIds.length > 0) {
            const dueDate = new Date(task.due_date);
            const formattedDate = dueDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: dueDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
            });

            const daysUntil = Math.ceil((dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            const urgency = daysUntil <= 1 ? '🔥 ' : daysUntil <= 3 ? '⏰ ' : '';

            const baseUrl = Deno.env.get('SUPABASE_URL');
            const notifUrl = userIds.length > 50 
                ? `${baseUrl}/functions/v1/queue-notification`
                : `${baseUrl}/functions/v1/send-notification`;

            fetch(notifUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
                body: JSON.stringify({
                    event: 'task_assigned',
                    targets: { user_ids: userIds },
                    payload: {
                        title: `📝 New ${task.subject ? task.subject + ' ' : ''}Task Assigned!`,
                        body: `${urgency}${task.title} - Due ${formattedDate} ✏️`,
                        data: {
                            type: 'task',
                            task_id: insertedTask.id,
                            title: task.title,
                            due_date: task.due_date,
                            subject: task.subject,
                        },
                    },
                }),
            }).catch(err => console.error('Task notification failed:', err));
            
            console.log(`Triggered task notification for ${userIds.length} users`);
        }

        // 5. Return
        return new Response(
            JSON.stringify({
                success: true,
                data: insertedTask,
                notified: students.length,
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
