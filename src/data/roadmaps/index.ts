import { LanguageRoadmap, RoadmapTopic, RoadmapChapter } from './types';

export * from './types';
export * from './loader';

/**
 * Extracts a flat list of all topics across all chapters in a language roadmap.
 * Supports both hierarchical chapters and legacy flat lesson arrays.
 */
export function getAllTopics(roadmap: LanguageRoadmap): RoadmapTopic[] {
  if (Array.isArray(roadmap.chapters) && roadmap.chapters.length > 0) {
    return roadmap.chapters.flatMap((chapter) => chapter.topics || []);
  }
  if (Array.isArray(roadmap.lessons)) {
    return roadmap.lessons;
  }
  return [];
}

/**
 * Finds a specific topic by ID within a language roadmap.
 */
export function findTopicById(
  roadmap: LanguageRoadmap,
  topicId: string
): { topic: RoadmapTopic; chapter?: RoadmapChapter } | undefined {
  if (Array.isArray(roadmap.chapters)) {
    for (const chapter of roadmap.chapters) {
      const topic = chapter.topics?.find((t) => t.id === topicId);
      if (topic) return { topic, chapter };
    }
  }
  if (Array.isArray(roadmap.lessons)) {
    const topic = roadmap.lessons.find((t) => t.id === topicId);
    if (topic) return { topic };
  }
  return undefined;
}
