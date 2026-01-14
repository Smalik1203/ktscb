import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface AttendanceRecord {
    student_id: string;
    class_instance_id: string;
    date: string;
    status: 'present' | 'absent';
    marked_by: string;
    marked_by_role_code: string;
    school_code: string;
}

Deno.serve(async (req: Request) => {
    try {
        const { records }: { records: AttendanceRecord[] } = await req.json();

        // Create Supabase client with service role
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // 1. Validate input
        if (!records || !Array.isArray(records) || records.length === 0) {
            return new Response(
                JSON.stringify({ error: 'Invalid input: records array required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Validate each record
        for (const record of records) {
            if (!record.student_id || !record.class_instance_id || !record.date || !record.status) {
                return new Response(
                    JSON.stringify({ error: 'Invalid record: missing required fields' }),
                    { status: 400, headers: { 'Content-Type': 'application/json' } }
                );
            }
        }

        // 2. Check for existing records and separate updates vs inserts
        const studentIds = records.map(r => r.student_id);
        const classId = records[0].class_instance_id;
        const date = records[0].date;

        const { data: existing } = await supabase
            .from('attendance')
            .select('id, student_id')
            .eq('class_instance_id', classId)
            .eq('date', date)
            .in('student_id', studentIds);

        const existingMap = new Map(existing?.map(e => [e.student_id, e.id]) || []);
        const updates: Array<{ id: string; record: AttendanceRecord }> = [];
        const inserts: AttendanceRecord[] = [];

        records.forEach(record => {
            const existingId = existingMap.get(record.student_id);
            if (existingId) {
                updates.push({ id: existingId, record });
            } else {
                inserts.push(record);
            }
        });

        // 3. Perform updates
        if (updates.length > 0) {
            const updatePromises = updates.map(({ id, record }) =>
                supabase
                    .from('attendance')
                    .update({
                        status: record.status,
                        marked_by: record.marked_by,
                        marked_by_role_code: record.marked_by_role_code,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', id)
            );

            const updateResults = await Promise.all(updatePromises);
            const updateErrors = updateResults.filter(r => r.error);

            if (updateErrors.length > 0) {
                return new Response(
                    JSON.stringify({ error: `Failed to update ${updateErrors.length} record(s)` }),
                    { status: 500, headers: { 'Content-Type': 'application/json' } }
                );
            }
        }

        // 4. Perform inserts
        let insertedData = null;
        if (inserts.length > 0) {
            const { data, error } = await supabase
                .from('attendance')
                .insert(inserts)
                .select();

            if (error) {
                return new Response(
                    JSON.stringify({ error: error.message }),
                    { status: 500, headers: { 'Content-Type': 'application/json' } }
                );
            }
            insertedData = data;
        }

        // 5. Trigger notifications (async, server-controlled)
        // Use queueMicrotask to not block response
        queueMicrotask(async () => {
            try {
                const notificationUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`;
                const authHeader = `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`;

                for (const record of records) {
                    // Fetch student's user_id from students table
                    const { data: student } = await supabase
                        .from('student')
                        .select('user_id')
                        .eq('id', record.student_id)
                        .single();

                    if (!student?.user_id) {
                        console.warn(`No user_id found for student ${record.student_id}`);
                        continue;
                    }

                    await fetch(notificationUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': authHeader,
                        },
                        body: JSON.stringify({
                            event: 'attendance_marked',
                            targets: { user_ids: [student.user_id] },
                            payload: {
                                title: record.status === 'present'
                                    ? '✅ Attendance Marked - Present!'
                                    : '⚠️ Attendance Marked - Absent',
                                body: record.status === 'present'
                                    ? `Great! You were marked present today (${new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}) 🎉`
                                    : `You were marked absent on ${new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} 📅`,
                                data: {
                                    type: 'attendance',
                                    status: record.status,
                                    date: record.date,
                                    class_instance_id: record.class_instance_id,
                                },
                            },
                        }),
                    });
                }
            } catch (err) {
                console.error('Notification trigger failed:', err);
                // Log but don't fail the request
            }
        });

        // 6. Return immediately
        return new Response(
            JSON.stringify({
                success: true,
                updated: updates.length,
                inserted: inserts.length,
                data: insertedData,
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
