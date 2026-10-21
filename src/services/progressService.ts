import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { AppTab } from '@/components/BottomNavBar';
import { LanguageRoadmap, LanguageProgress, getAllTopics } from '@/data/roadmaps';
import { SubjectItem, getAllSubjectTopics } from '@/data/subjects';

export interface ActiveStudyItem {
  id: string;
  category: 'language' | 'subject';
  badge: string;
  badgeColor: string;
  badgeBg: string;
  title: string;
  subtitle: string;
  progressPercent: number;
  timeLeft: string;
  currentStep: string;
  iconName: keyof typeof Ionicons.glyphMap | string;
  targetTab: AppTab;
  languageId?: string;
  subjectId?: string;
  topicId?: string;
}

export interface RecentStudyRecord {
  trackId: string;
  type: 'language' | 'subject';
  topicId: string;
  timestamp: number;
}

const STORAGE_KEY_COMPLETED_LESSONS = '@axiombyte_completed_lessons_v1';
const STORAGE_KEY_RECENT_STUDIES = '@axiombyte_recent_studies_v1';
const STORAGE_KEY_DISMISSED_ACTIVE_TRACKS = '@axiombyte_dismissed_active_tracks_v1';

/**
 * Loads list of dismissed track IDs from local storage
 */
export async function loadDismissedActiveTracks(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_DISMISSED_ACTIVE_TRACKS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Dismisses a track from "Continue Studying" and clears its active/recent status.
 * Optionally resets completed lessons for that specific track.
 */
export async function dismissTrackFromActiveStudies(
  trackId: string,
  topicIdsToRemove: string[] = []
): Promise<void> {
  try {
    // 1. Add to dismissed tracks list
    const currentDismissed = await loadDismissedActiveTracks();
    if (!currentDismissed.includes(trackId)) {
      await AsyncStorage.setItem(
        STORAGE_KEY_DISMISSED_ACTIVE_TRACKS,
        JSON.stringify([...currentDismissed, trackId])
      );
    }

    // 2. Remove from recent studies
    const currentRecents = await loadRecentStudies();
    const updatedRecents = currentRecents.filter((r) => r.trackId !== trackId);
    await AsyncStorage.setItem(STORAGE_KEY_RECENT_STUDIES, JSON.stringify(updatedRecents));

    // 3. Clear any completed lessons belonging to this track
    if (topicIdsToRemove.length > 0) {
      const currentCompleted = await loadCompletedLessonIds();
      const updatedCompleted = currentCompleted.filter((id) => !topicIdsToRemove.includes(id));
      await AsyncStorage.setItem(STORAGE_KEY_COMPLETED_LESSONS, JSON.stringify(updatedCompleted));
    }
  } catch (err) {
    console.warn('[ProgressService] Failed to dismiss track from active studies:', err);
  }
}

/**
 * Loads all completed lesson/topic IDs from local offline storage
 */
export async function loadCompletedLessonIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_COMPLETED_LESSONS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Loads list of recently visited study tracks and topic IDs
 */
export async function loadRecentStudies(): Promise<RecentStudyRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_RECENT_STUDIES);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Records a topic as recently opened/studied
 */
export async function recordLastVisitedTopic(
  trackId: string,
  type: 'language' | 'subject',
  topicId: string
): Promise<void> {
  try {
    // Un-dismiss if the user voluntarily visits this track again
    const dismissed = await loadDismissedActiveTracks();
    if (dismissed.includes(trackId)) {
      await AsyncStorage.setItem(
        STORAGE_KEY_DISMISSED_ACTIVE_TRACKS,
        JSON.stringify(dismissed.filter((id) => id !== trackId))
      );
    }

    const current = await loadRecentStudies();
    const updated = [
      { trackId, type, topicId, timestamp: Date.now() },
      ...current.filter((c) => c.trackId !== trackId),
    ].slice(0, 10);
    await AsyncStorage.setItem(STORAGE_KEY_RECENT_STUDIES, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Toggles the completion status of a topic/lesson.
 * Returns the updated list of completed IDs.
 */
export async function toggleLessonCompletion(lessonId: string): Promise<string[]> {
  try {
    const current = await loadCompletedLessonIds();
    let updated: string[];

    if (current.includes(lessonId)) {
      updated = current.filter((id) => id !== lessonId);
    } else {
      updated = [...current, lessonId];
    }

    await AsyncStorage.setItem(STORAGE_KEY_COMPLETED_LESSONS, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

/**
 * Checks whether a specific topic/lesson is completed
 */
export function isLessonCompleted(lessonId: string, completedIds: string[]): boolean {
  return completedIds.includes(lessonId);
}

/**
 * Computes progress stats for a given language roadmap across all chapters
 */
export function calculateLanguageProgress(
  roadmap: LanguageRoadmap,
  completedIds: string[]
): LanguageProgress {
  const topics = getAllTopics(roadmap);
  if (topics.length === 0) {
    return { completed: 0, total: 0, percent: 0, isCompleted: false };
  }

  const completedCount = topics.filter((t) => completedIds.includes(t.id)).length;
  const total = topics.length;
  const percent = Math.round((completedCount / total) * 100);

  return {
    completed: completedCount,
    total,
    percent,
    isCompleted: completedCount === total && total > 0,
  };
}

/**
 * Dynamically computes real active courses for "Continue Studying"
 * based on actual curriculum data, completed lessons, and recent study activity.
 */
export function buildDynamicActiveCourses(
  languages: LanguageRoadmap[],
  subjects: SubjectItem[],
  completedLessonIds: string[] = [],
  recentStudies: RecentStudyRecord[] = [],
  dismissedTrackIds: string[] = []
): ActiveStudyItem[] {
  type ScoredItem = ActiveStudyItem & {
    _isStarted: boolean;
    _isCompleted: boolean;
    _recentTimestamp: number;
    _order: number;
  };

  const items: ScoredItem[] = [];

  // 1. Process all Languages
  (languages || []).forEach((rm, idx) => {
    // Skip if dismissed by user
    if (dismissedTrackIds.includes(rm.id)) return;

    const topics = getAllTopics(rm);
    if (topics.length === 0) return;

    const completedCount = topics.filter((t) => completedLessonIds.includes(t.id)).length;
    const isCompleted = completedCount === topics.length && topics.length > 0;
    const recent = recentStudies.find((r) => r.trackId === rm.id);
    const isStarted = completedCount > 0 || recent !== undefined;

    // Show only started languages
    if (!isStarted) return;

    const percent = Math.round((completedCount / topics.length) * 100);

    let targetTopic = recent ? topics.find((t) => t.id === recent.topicId) : undefined;
    if (!targetTopic) {
      targetTopic = topics.find((t) => !completedLessonIds.includes(t.id)) || topics[0];
    }

    const topicIndex = topics.findIndex((t) => t.id === targetTopic.id) + 1;
    const chapter = rm.chapters?.find((c) => c.topics.some((t) => t.id === targetTopic.id));

    items.push({
      id: `active_lang_${rm.id}`,
      category: 'language',
      badge: rm.badge || `${rm.name.toUpperCase()} DEV`,
      badgeColor: rm.color || '#38BDF8',
      badgeBg: `${rm.color || '#38BDF8'}18`,
      title: targetTopic.title,
      subtitle:
        targetTopic.summary ||
        targetTopic.explanation ||
        (chapter?.title ? `Chapter: ${chapter.title}` : rm.description),
      progressPercent: percent,
      timeLeft: targetTopic.duration ? `${targetTopic.duration} left` : '15 min left',
      currentStep: `Lesson ${topicIndex > 0 ? topicIndex : 1} of ${topics.length}`,
      iconName: rm.icon || 'terminal',
      targetTab: 'roadmaps',
      languageId: rm.id,
      topicId: targetTopic.id,
      _isStarted: isStarted,
      _isCompleted: isCompleted,
      _recentTimestamp: recent ? recent.timestamp : 0,
      _order: rm.order ?? idx,
    });
  });

  // 2. Process all Subjects
  (subjects || []).forEach((subj, idx) => {
    // Skip if dismissed by user
    if (dismissedTrackIds.includes(subj.id)) return;

    const topics = getAllSubjectTopics(subj);
    if (topics.length === 0) return;

    const completedCount = topics.filter((t) => completedLessonIds.includes(t.id)).length;
    const isCompleted = completedCount === topics.length && topics.length > 0;
    const recent = recentStudies.find((r) => r.trackId === subj.id);
    const isStarted = completedCount > 0 || recent !== undefined;

    // Show only started subjects
    if (!isStarted) return;

    const percent = Math.round((completedCount / topics.length) * 100);

    let targetTopic = recent ? topics.find((t) => t.id === recent.topicId) : undefined;
    if (!targetTopic) {
      targetTopic = topics.find((t) => !completedLessonIds.includes(t.id)) || topics[0];
    }

    const topicIndex = topics.findIndex((t) => t.id === targetTopic.id) + 1;
    const chapter = subj.chapters?.find((c) => c.topics.some((t) => t.id === targetTopic.id));

    items.push({
      id: `active_subj_${subj.id}`,
      category: 'subject',
      badge: subj.badge || subj.name.toUpperCase(),
      badgeColor: subj.color || '#F59E0B',
      badgeBg: `${subj.color || '#F59E0B'}18`,
      title: targetTopic.title,
      subtitle:
        targetTopic.definition ||
        targetTopic.example ||
        (chapter?.title ? `Chapter: ${chapter.title}` : subj.description),
      progressPercent: percent,
      timeLeft: targetTopic.duration ? `${targetTopic.duration} left` : '15 min left',
      currentStep: `Topic ${topicIndex > 0 ? topicIndex : 1} of ${topics.length}`,
      iconName: subj.icon || 'book',
      targetTab: 'math',
      subjectId: subj.id,
      topicId: targetTopic.id,
      _isStarted: isStarted,
      _isCompleted: isCompleted,
      _recentTimestamp: recent ? recent.timestamp : 0,
      _order: subj.order ?? idx + 10,
    });
  });

  // 3. Sort:
  // - Tracks with recent study activity first (latest timestamp first)
  // - In-progress tracks (started but not 100% completed)
  // - Unstarted tracks (sorted by default curriculum order)
  // - Completed tracks
  items.sort((a, b) => {
    if (a._recentTimestamp > 0 && b._recentTimestamp > 0) {
      return b._recentTimestamp - a._recentTimestamp;
    }
    if (a._recentTimestamp > 0) return -1;
    if (b._recentTimestamp > 0) return 1;

    const aActive = a._isStarted && !a._isCompleted;
    const bActive = b._isStarted && !b._isCompleted;
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;

    if (a._isCompleted && !b._isCompleted) return 1;
    if (!a._isCompleted && b._isCompleted) return -1;

    return a._order - b._order;
  });

  return items.map(({ _isStarted, _isCompleted, _recentTimestamp, _order, ...clean }) => clean);
}
