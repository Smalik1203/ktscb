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

interface NotificationResult {
    sent: boolean;
    presentCount: number;
    absentCount: number;
    error?: string;
}

Deno.serve(async (req: Request) => {
    try {
        const { records }: { records: AttendanceRecord[] } = await req.json();

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

        for (const record of records) {
            if (!record.student_id || !record.class_instance_id || !record.date || !record.status) {
                return new Response(
                    JSON.stringify({ error: 'Invalid record: missing required fields' }),
                    { status: 400, headers: { 'Content-Type': 'application/json' } }
                );
            }
        }

        // 2. Check for existing records
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
                .select('id, student_id, class_instance_id, status, date, marked_by, created_at, school_code, marked_by_role_code, updated_at');

            if (error) {
                return new Response(
                    JSON.stringify({ error: error.message }),
                    { status: 500, headers: { 'Content-Type': 'application/json' } }
                );
            }
            insertedData = data;
        }

        // 5. SEND NOTIFICATIONS (awaited for guaranteed delivery)
        const notificationResult: NotificationResult = {
            sent: false,
            presentCount: 0,
            absentCount: 0,
        };

        try {
            const authHeader = `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`;
            const baseUrl = Deno.env.get('SUPABASE_URL');

            // Fetch student auth_user_id (student table has auth_user_id, not user_id)
            const { data: students } = await supabase
                .from('student')
                .select('id, auth_user_id')
                .in('id', studentIds);

            if (students && students.length > 0) {
                const studentMap = new Map(students.map(s => [s.id, s.auth_user_id]));

                const presentUserIds: string[] = [];
                const absentUserIds: string[] = [];

                for (const record of records) {
                    const userId = studentMap.get(record.student_id);
                    if (!userId) continue;

                    if (record.status === 'present') {
                        presentUserIds.push(userId);
                    } else {
                        absentUserIds.push(userId);
                    }
                }

                notificationResult.presentCount = presentUserIds.length;
                notificationResult.absentCount = absentUserIds.length;

                const formattedDate = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const notificationPromises: Promise<Response>[] = [];

                // Send present notifications
                if (presentUserIds.length > 0) {
                    const notifUrl = presentUserIds.length > 50 
                        ? `${baseUrl}/functions/v1/queue-notification`
                        : `${baseUrl}/functions/v1/send-notification`;

                    notificationPromises.push(
                        fetch(notifUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
                            body: JSON.stringify({
                                event: 'attendance_marked',
                                targets: { user_ids: presentUserIds },
                                payload: {
                                    title: '✅ Attendance Marked - Present!',
                                    body: `Great! You were marked present today (${formattedDate}) 🎉`,
                                    data: {
                                        type: 'attendance',
                                        status: 'present',
                                        date: date,
                                        class_instance_id: classId,
                                    },
                                },
                            }),
                        })
                    );
                }

                // Send absent notifications
                if (absentUserIds.length > 0) {
                    const notifUrl = absentUserIds.length > 50 
                        ? `${baseUrl}/functions/v1/queue-notification`
                        : `${baseUrl}/functions/v1/send-notification`;

                    notificationPromises.push(
                        fetch(notifUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
                            body: JSON.stringify({
                                event: 'attendance_marked',
                                targets: { user_ids: absentUserIds },
                                payload: {
                                    title: '⚠️ Attendance Marked - Absent',
                                    body: `You were marked absent on ${formattedDate} 📅`,
                                    data: {
                                        type: 'attendance',
                                        status: 'absent',
                                        date: date,
                                        class_instance_id: classId,
                                    },
                                },
                            }),
                        })
                    );
                }

                // Wait for all notifications to complete
                if (notificationPromises.length > 0) {
                    const results = await Promise.all(notificationPromises);
                    const allOk = results.every(r => r.ok);
                    
                    if (allOk) {
                        notificationResult.sent = true;
                        console.log(`Notifications sent: ${presentUserIds.length} present, ${absentUserIds.length} absent`);
                    } else {
                        const failedResponses = results.filter(r => !r.ok);
                        const errorTexts = await Promise.all(failedResponses.map(r => r.text()));
                        notificationResult.error = `Some notifications failed: ${errorTexts.join(', ')}`;
                        console.error('Notification errors:', notificationResult.error);
                    }
                } else {
                    notificationResult.sent = true; // No notifications needed
                }
            } else {
                notificationResult.sent = true; // No students to notify
                console.log('No students found for notifications');
            }
        } catch (notifError) {
            notificationResult.error = (notifError as Error).message;
            console.error('Notification error:', notifError);
        }

        // 6. Return success with notification status
        return new Response(
            JSON.stringify({
                success: true,
                updated: updates.length,
                inserted: inserts.length,
                data: insertedData,
                notifications: notificationResult,
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
