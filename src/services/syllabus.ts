import { supabase } from '../lib/supabase';
import type { Database } from '../types/database.types';

export type UUID = string;

export type ClassInstance = {
	id: UUID;
	grade: number | null;
	section: string | null;
};

export type Subject = {
	id: UUID;
	subject_name: string;
};

export type SyllabusChapter = {
	id: UUID;
	chapter_no: number;
	title: string;
	description: string | null;
	ref_code: string | null;
};

export type SyllabusTopic = {
	id: UUID;
	chapter_id: UUID;
	topic_no: number;
	title: string;
	description: string | null;
	ref_code: string | null;
};

export type SyllabusTree = {
	chapters: {
		chapter: SyllabusChapter;
		topics: SyllabusTopic[];
	}[];
};

export async function fetchSubjectsForSchool(schoolCode: string) {
	const { data, error } = await supabase
		.from('subjects')
		.select('id, subject_name')
		.eq('school_code', schoolCode)
		.order('subject_name', { ascending: true });
	if (error) throw error;
	return (data || []) as Subject[];
}

export async function fetchClassesForSchool(schoolCode: string) {
	const { data, error } = await supabase
		.from('class_instances')
		.select('id, grade, section')
		.eq('school_code', schoolCode)
		.order('grade', { ascending: true });
	if (error) throw error;
	return (data || []) as ClassInstance[];
}

export async function ensureSyllabusId(classInstanceId: UUID, subjectId: UUID) {
	// Find or create syllabus for class+subject
	const { data: found, error: findError } = await supabase
		.from('syllabi')
		.select('id')
		.eq('class_instance_id', classInstanceId)
		.eq('subject_id', subjectId)
		.maybeSingle();
	if (findError) throw findError;
	if (found?.id) return found.id as UUID;
	
	// Get school_code from class_instance
	const { data: classInstance, error: classError } = await supabase
		.from('class_instances')
		.select('school_code')
		.eq('id', classInstanceId)
		.single();
	if (classError || !classInstance?.school_code) {
		throw new Error('Could not find school_code for class instance');
	}
	
	const { data: auth } = await supabase.auth.getUser();
	const createdBy = auth.user?.id as UUID;
	const { data: inserted, error: insError } = await supabase
		.from('syllabi')
		.insert({ class_instance_id: classInstanceId, subject_id: subjectId, school_code: classInstance.school_code, created_by: createdBy } as Database['public']['Tables']['syllabi']['Insert'])
		.select('id')
		.single();
	if (insError) throw insError;
	return inserted.id as UUID;
}

export async function fetchSyllabusTree(classInstanceId: UUID, subjectId: UUID): Promise<SyllabusTree> {
	// Prefer backend RPC if available for consistent ordering and shape
	const { data, error } = await supabase.rpc('get_syllabus_tree', {
		p_class_instance_id: classInstanceId,
		p_subject_id: subjectId,
	});
	if (!error && data) {
		return data as unknown as SyllabusTree;
	}
	// Fallback: stitch manually
	const { data: sy } = await supabase
		.from('syllabi')
		.select('id')
		.eq('class_instance_id', classInstanceId)
		.eq('subject_id', subjectId)
		.maybeSingle();
	const syllabusId = sy?.id as UUID | undefined;
	if (!syllabusId) return { chapters: [] };
	const { data: chapters } = await supabase
		.from('syllabus_chapters')
		.select('id, chapter_no, title, description, ref_code')
		.eq('syllabus_id', syllabusId)
		.order('chapter_no', { ascending: true });
	const { data: topics } = await supabase
		.from('syllabus_topics')
		.select('id, chapter_id, topic_no, title, description, ref_code')
		.in('chapter_id', (chapters || []).map(c => c.id))
		.order('topic_no', { ascending: true });
	const byChapter = new Map<string, SyllabusTopic[]>();
	(topics || []).forEach(t => {
		const arr = byChapter.get(t.chapter_id) || [];
		arr.push(t as SyllabusTopic);
		byChapter.set(t.chapter_id, arr);
	});
	return {
		chapters: (chapters || []).map(c => ({
			chapter: c as SyllabusChapter,
			topics: byChapter.get(c.id) || [],
		})),
	};
}

export async function fetchProgress(classInstanceId: UUID, subjectId: UUID) {
	const { data, error } = await supabase
		.from('syllabus_progress')
		.select('syllabus_chapter_id, syllabus_topic_id')
		.eq('class_instance_id', classInstanceId)
		.eq('subject_id', subjectId);
	if (error) throw error;
	const taughtChapters = new Set<string>();
	const taughtTopics = new Set<string>();
	(data || []).forEach(row => {
		if (row.syllabus_chapter_id) taughtChapters.add(row.syllabus_chapter_id);
		if (row.syllabus_topic_id) taughtTopics.add(row.syllabus_topic_id);
	});
	return { taughtChapters, taughtTopics };
}

export async function addChapter(syllabusId: UUID, payload: Pick<SyllabusChapter, 'title' | 'description'>) {
	const { data: existing } = await supabase
		.from('syllabus_chapters')
		.select('chapter_no')
		.eq('syllabus_id', syllabusId)
		.order('chapter_no', { ascending: false })
		.limit(1);
	const nextNo = (existing?.[0]?.chapter_no || 0) + 1;
    const { data: auth } = await supabase.auth.getUser();
    const createdBy = auth.user?.id as UUID;
	const { data, error } = await supabase
		.from('syllabus_chapters')
		.insert({ syllabus_id: syllabusId, title: payload.title, description: payload.description || null, chapter_no: nextNo, created_by: createdBy } as Database['public']['Tables']['syllabus_chapters']['Insert'])
		.select('*')
		.single();
	if (error) throw error;
	return data as unknown as SyllabusChapter;
}

export async function updateChapter(chapterId: UUID, payload: Partial<Pick<SyllabusChapter, 'title' | 'description'>>) {
	const { data, error } = await supabase
		.from('syllabus_chapters')
		.update({ title: payload.title, description: payload.description })
		.eq('id', chapterId)
		.select('*')
		.single();
	if (error) throw error;
	return data as unknown as SyllabusChapter;
}

export async function deleteChapter(chapterId: UUID) {
	const { error } = await supabase.from('syllabus_chapters').delete().eq('id', chapterId);
	if (error) throw error;
}

export async function addTopic(chapterId: UUID, payload: Pick<SyllabusTopic, 'title' | 'description'>) {
	const { data: existing } = await supabase
		.from('syllabus_topics')
		.select('topic_no')
		.eq('chapter_id', chapterId)
		.order('topic_no', { ascending: false })
		.limit(1);
	const nextNo = (existing?.[0]?.topic_no || 0) + 1;
    const { data: auth } = await supabase.auth.getUser();
    const createdBy = auth.user?.id as UUID;
	const { data, error } = await supabase
		.from('syllabus_topics')
		.insert({ chapter_id: chapterId, title: payload.title, description: payload.description || null, topic_no: nextNo, created_by: createdBy } as Database['public']['Tables']['syllabus_topics']['Insert'])
		.select('*')
		.single();
	if (error) throw error;
	return data as unknown as SyllabusTopic;
}

export async function updateTopic(topicId: UUID, payload: Partial<Pick<SyllabusTopic, 'title' | 'description'>>) {
	const { data, error } = await supabase
		.from('syllabus_topics')
		.update({ title: payload.title, description: payload.description })
		.eq('id', topicId)
		.select('*')
		.single();
	if (error) throw error;
	return data as unknown as SyllabusTopic;
}

export async function deleteTopic(topicId: UUID) {
	const { error } = await supabase.from('syllabus_topics').delete().eq('id', topicId);
	if (error) throw error;
}

export async function markTaught(args: {
	classInstanceId: UUID;
	subjectId: UUID;
	schoolCode: string;
	teacherId: UUID;
	timetableSlotId: UUID;
	dateISO: string;
	syllabusChapterId?: UUID;
	syllabusTopicId?: UUID;
}) {
	const { error } = await supabase.rpc('mark_syllabus_taught', {
		p_class_instance_id: args.classInstanceId,
		p_date: args.dateISO,
		p_school_code: args.schoolCode,
		p_subject_id: args.subjectId,
		p_syllabus_chapter_id: args.syllabusChapterId,
		p_syllabus_topic_id: args.syllabusTopicId,
		p_teacher_id: args.teacherId,
		p_timetable_slot_id: args.timetableSlotId,
	});
	if (error) throw error;
}

export async function unmarkTaught(schoolCode: string, timetableSlotId: UUID) {
	const { error } = await supabase.rpc('unmark_syllabus_taught', {
		p_school_code: schoolCode,
		p_timetable_slot_id: timetableSlotId,
	});
	if (error) throw error;
}

export function computeProgress(tree: SyllabusTree, taught: { taughtChapters: Set<string>; taughtTopics: Set<string> }) {
	const totalChapters = tree.chapters.length;
	const completedChapters = tree.chapters.filter(c => taught.taughtChapters.has(c.chapter.id)).length;
	const startedChapters = tree.chapters.filter(c => {
		// A chapter is considered "started" if it has any completed topics
		return c.topics.some(t => taught.taughtTopics.has(t.id));
	}).length;
	let totalTopics = 0;
	let completedTopics = 0;
	for (const c of tree.chapters) {
		totalTopics += c.topics.length;
		completedTopics += c.topics.filter(t => taught.taughtTopics.has(t.id)).length;
	}
	const overallPct = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : (totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 0);
	return { totalChapters, completedChapters, startedChapters, totalTopics, completedTopics, overallPct };
}

export type CsvRow = { type: 'chapter' | 'topic'; chapter_no?: number; topic_no?: number; chapter_title?: string; chapter_description?: string; topic_title?: string; topic_description?: string };

export function parseCsv(content: string): CsvRow[] {
	const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
	if (lines.length === 0) return [];
	const header = lines[0].split(',').map(h => h.trim().toLowerCase());
	const idx = (name: string) => header.indexOf(name);
	const rows: CsvRow[] = [];
	for (let i = 1; i < lines.length; i++) {
		const cols = lines[i].split(',').map(c => c.trim());
		const type = (cols[idx('type')] || '').toLowerCase();
		if (type !== 'chapter' && type !== 'topic') continue;
		rows.push({
			type: type as 'chapter' | 'topic',
			chapter_no: Number(cols[idx('chapter_no')] || '0') || undefined,
			topic_no: Number(cols[idx('topic_no')] || '0') || undefined,
			chapter_title: cols[idx('chapter_title')] || undefined,
			chapter_description: cols[idx('chapter_description')] || undefined,
			topic_title: cols[idx('topic_title')] || undefined,
			topic_description: cols[idx('topic_description')] || undefined,
		});
	}
	return rows;
}

export function exportCsv(tree: SyllabusTree): string {
	const header = 'type,chapter_no,chapter_title,chapter_description,topic_no,topic_title,topic_description';
	const lines: string[] = [header];
	for (const node of tree.chapters) {
		lines.push(['chapter', node.chapter.chapter_no, quote(node.chapter.title), quote(node.chapter.description || ''), '', '', ''].join(','));
		for (const t of node.topics) {
			lines.push(['topic', node.chapter.chapter_no, quote(node.chapter.title), '', t.topic_no, quote(t.title), quote(t.description || '')].join(','));
		}
	}
	return lines.join('\n');
}

function quote(s: string) {
	const v = s.replaceAll('"', '""');
	return `"${v}"`;
}


