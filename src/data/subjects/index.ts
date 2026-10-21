import { SubjectItem, SubjectTopic, SubjectChapter } from './types';

export * from './types';
export * from './loader';

/**
 * Extracts a flat list of all topics across all chapters in a subject.
 */
export function getAllSubjectTopics(subject: SubjectItem): SubjectTopic[] {
  if (Array.isArray(subject.chapters) && subject.chapters.length > 0) {
    return subject.chapters.flatMap((chapter) => chapter.topics || []);
  }
  if (Array.isArray(subject.topics)) {
    return subject.topics;
  }
  return [];
}

/**
 * Finds a specific topic by ID within a subject.
 */
export function findSubjectTopicById(
  subject: SubjectItem,
  topicId: string
): { topic: SubjectTopic; chapter?: SubjectChapter } | undefined {
  if (Array.isArray(subject.chapters)) {
    for (const chapter of subject.chapters) {
      const topic = chapter.topics?.find((t) => t.id === topicId);
      if (topic) return { topic, chapter };
    }
  }
  if (Array.isArray(subject.topics)) {
    const topic = subject.topics.find((t) => t.id === topicId);
    if (topic) return { topic };
  }
  return undefined;
}
