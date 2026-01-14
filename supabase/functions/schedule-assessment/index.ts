import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface AssessmentInput {
    title: string;
    description?: string;
    date: string;
    class_instance_id: string;
    subject: string;
    total_marks?: number;
    created_by: string;
    school_code: string;
}

Deno.serve(async (req: Request) => {
    try {
        const { assessment }: { assessment: AssessmentInput } = await req.json();

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // 1. Validate input
        if (!assessment || !assessment.title || !assessment.date || !assessment.class_instance_id || !assessment.subject) {
            return new Response(
                JSON.stringify({ error: 'Invalid input: title, date, class_instance_id, and subject required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // 2. Insert assessment into database
        const { data: insertedAssessment, error: insertError } = await supabase
            .from('assessments')
            .insert({
                title: assessment.title,
                description: assessment.description,
                date: assessment.date,
                class_instance_id: assessment.class_instance_id,
                subject: assessment.subject,
                total_marks: assessment.total_marks || 100,
                created_by: assessment.created_by,
                school_code: assessment.school_code,
            })
            .select()
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
            .eq('class_instance_id', assessment.class_instance_id);

        if (studentsError || !students || students.length === 0) {
            console.warn('No students found for class:', assessment.class_instance_id);
            return new Response(
                JSON.stringify({ success: true, data: insertedAssessment, notified: 0 }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // 4. Trigger notifications (async, server-controlled)
        queueMicrotask(async () => {
            try {
                const notificationUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`;
                const authHeader = `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`;

                const userIds = students.map(s => s.user_id).filter(Boolean);

                if (userIds.length === 0) {
                    console.warn('No valid user_ids found');
                    return;
                }

                // Format assessment date
                const assessmentDate = new Date(assessment.date);
                const formattedDate = assessmentDate.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                });

                // Calculate days until assessment
                const daysUntil = Math.ceil((assessmentDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

                let emoji = '📊';
                let encouragement = 'Good luck!';

                if (daysUntil <= 1) {
                    emoji = '🔥';
                    encouragement = 'It\'s tomorrow! Final prep time!';
                } else if (daysUntil <= 3) {
                    emoji = '⏰';
                    encouragement = 'Start preparing now!';
                } else if (daysUntil <= 7) {
                    emoji = '📚';
                    encouragement = 'Time to start studying!';
                }

                await fetch(notificationUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': authHeader,
                    },
                    body: JSON.stringify({
                        event: 'assessment_scheduled',
                        targets: { user_ids: userIds },
                        payload: {
                            title: `${emoji} ${assessment.subject} Test Scheduled!`,
                            body: `${assessment.title} on ${formattedDate} - ${encouragement} 💪`,
                            data: {
                                type: 'assessment',
                                assessment_id: insertedAssessment.id,
                                title: assessment.title,
                                date: assessment.date,
                                subject: assessment.subject,
                            },
                        },
                    }),
                });
            } catch (err) {
                console.error('Notification trigger failed:', err);
            }
        });

        // 5. Return immediately
        return new Response(
            JSON.stringify({
                success: true,
                data: insertedAssessment,
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
