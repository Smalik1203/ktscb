import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useMemo } from 'react';

export interface SyllabusChapter {
  id: string;
  chapter_no: number;
  title: string;
  syllabus_id: string;
  syllabus_topics: SyllabusTopic[];
}

export interface SyllabusTopic {
  id: string;
  topic_no: number;
  title: string;
  chapter_id: string;
}

export interface SyllabusUnit {
  unit_no: string; // "chapter_no" or "chapter_no.topic_no"
  subject_id: string;
  type: 'chapter' | 'topic';
  chapter_id: string;
  topic_id?: string;
}

export interface SyllabusContent {
  chapter_no: number;
  topic_no?: number;
  title: string;
  subject: string;
}

export interface SyllabusLoaderResult {
  chaptersById: Map<string, SyllabusUnit>;
  syllabusContentMap: Map<string, SyllabusContent>;
  loading: boolean;
  refetch: () => void;
}

export function useSyllabusLoader(classId?: string, schoolCode?: string): SyllabusLoaderResult {
  const { data: syllabi, isLoading, refetch } = useQuery({
    queryKey: ['syllabi', classId, schoolCode],
    queryFn: async ({ signal }) => {
      if (!classId || !schoolCode) return [];
      
      // Load syllabi for the class
      const { data: syllabiData, error: syllabiError } = await supabase
        .from('syllabi')
        .select('id, subject_id')
        .eq('class_instance_id', classId)
        .eq('school_code', schoolCode)
        .abortSignal(signal);

      if (syllabiError) throw syllabiError;
      if (!syllabiData || syllabiData.length === 0) return [];

      const syllabusIds = syllabiData.map(s => s.id);

      // Load chapters and topics for all syllabi
      const { data: chaptersData, error: chaptersError } = await supabase
        .from('syllabus_chapters')
        .select(`
          id,
          chapter_no,
          title,
          syllabus_id,
          syllabus_topics (
            id,
            topic_no,
            title
          )
        `)
        .in('syllabus_id', syllabusIds)
        .order('chapter_no', { ascending: true })
        .abortSignal(signal);

      if (chaptersError) throw chaptersError;

      return {
        syllabi: syllabiData,
        chapters: chaptersData || []
      };
    },
    enabled: !!classId && !!schoolCode,
    staleTime: 10 * 60 * 1000, // 10 minutes - syllabus changes infrequently
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2, // Reduce retries for faster failure feedback
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: true, // ✅ Ensures fresh data when user returns
    refetchOnMount: true,
  });

  const chaptersById = useMemo(() => {
    if (!syllabi || Array.isArray(syllabi) || !syllabi.chapters) return new Map();

    const map = new Map<string, SyllabusUnit>();
    
    syllabi.chapters.forEach((chapter: any) => {
      // Add chapter entry
      const chapterUnit: SyllabusUnit = {
        unit_no: chapter.chapter_no.toString(),
        subject_id: syllabi.syllabi.find((s: any) => s.id === chapter.syllabus_id)?.subject_id || '',
        type: 'chapter',
        chapter_id: chapter.id,
      };
      map.set(chapter.id, chapterUnit);

      // Add topic entries
      if (chapter.syllabus_topics) {
        chapter.syllabus_topics.forEach((topic: any) => {
          const topicUnit: SyllabusUnit = {
            unit_no: `${chapter.chapter_no}.${topic.topic_no}`,
            subject_id: syllabi.syllabi.find((s: any) => s.id === chapter.syllabus_id)?.subject_id || '',
            type: 'topic',
            chapter_id: chapter.id,
            topic_id: topic.id,
          };
          map.set(topic.id, topicUnit);
        });
      }
    });

    return map;
  }, [syllabi]);

  const syllabusContentMap = useMemo(() => {
    if (!syllabi || Array.isArray(syllabi) || !syllabi.chapters) return new Map();

    const map = new Map<string, SyllabusContent>();
    
    syllabi.chapters.forEach((chapter: any) => {
      const subjectId = syllabi.syllabi.find((s: any) => s.id === chapter.syllabus_id)?.subject_id;
      
      // Add chapter content
      map.set(`chapter_${chapter.id}`, {
        chapter_no: chapter.chapter_no,
        title: chapter.title,
        subject: subjectId || '',
      });

      // Add topic content
      if (chapter.syllabus_topics) {
        chapter.syllabus_topics.forEach((topic: any) => {
          map.set(`topic_${topic.id}`, {
            chapter_no: chapter.chapter_no,
            topic_no: topic.topic_no,
            title: topic.title,
            subject: subjectId || '',
          });
        });
      }
    });

    return map;
  }, [syllabi]);

  return {
    chaptersById,
    syllabusContentMap,
    loading: isLoading,
    refetch,
  };
}
