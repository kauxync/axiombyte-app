import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import {
  CurriculumPayload,
  LanguageRoadmap,
  SubjectCurriculum,
  MathTopic,
  ActiveStudyItem,
  LabExample,
  DEFAULT_CURRICULUM_SEED,
  loadCachedCurriculum,
  syncCurriculumWithServer,
  clearCurriculumCache,
} from '@/services/curriculumService';
import { clearAllContentCaches } from '@/services/contentService';
import {
  loadCompletedLessonIds,
  loadRecentStudies,
  loadDismissedActiveTracks,
  dismissTrackFromActiveStudies,
  buildDynamicActiveCourses,
  RecentStudyRecord,
} from '@/services/progressService';
import { getAllTopics } from '@/data/roadmaps';
import { getAllSubjectTopics } from '@/data/subjects';

interface CurriculumContextType {
  curriculum: CurriculumPayload;
  languages: LanguageRoadmap[];
  subjects: SubjectCurriculum[];
  mathTopics: MathTopic[];
  activeCourses: ActiveStudyItem[];
  labExamples: LabExample[];
  isLoading: boolean;
  isOffline: boolean;
  refreshCurriculum: (
    options?: { force?: boolean }
  ) => Promise<{ isOffline: boolean; languagesCount: number; subjectsCount: number }>;
  refreshProgress: () => Promise<void>;
  clearCache: () => Promise<void>;
  removeActiveCourse: (trackId: string, category: 'language' | 'subject') => Promise<void>;
}

const CurriculumContext = createContext<CurriculumContextType>({
  curriculum: DEFAULT_CURRICULUM_SEED,
  languages: [],
  subjects: [],
  mathTopics: [],
  activeCourses: [],
  labExamples: [],
  isLoading: true,
  isOffline: false,
  refreshCurriculum: async () => ({
    isOffline: false,
    languagesCount: 0,
    subjectsCount: 0,
  }),
  refreshProgress: async () => {},
  clearCache: async () => {},
  removeActiveCourse: async () => {},
});

export function CurriculumProvider({ children }: { children: React.ReactNode }) {
  const [curriculum, setCurriculum] = useState<CurriculumPayload>(DEFAULT_CURRICULUM_SEED);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [completedTopicIds, setCompletedTopicIds] = useState<string[]>([]);
  const [recentStudies, setRecentStudies] = useState<RecentStudyRecord[]>([]);
  const [dismissedTrackIds, setDismissedTrackIds] = useState<string[]>([]);

  const refreshProgress = useCallback(async () => {
    try {
      const [ids, recents, dismissed] = await Promise.all([
        loadCompletedLessonIds(),
        loadRecentStudies(),
        loadDismissedActiveTracks(),
      ]);
      setCompletedTopicIds(ids);
      setRecentStudies(recents);
      setDismissedTrackIds(dismissed);
    } catch {
      // ignore
    }
  }, []);

  // Sync with API on every app launch, falling back to local cached memory
  const refreshCurriculum = useCallback(
    async (
      options?: { force?: boolean }
    ): Promise<{ isOffline: boolean; languagesCount: number; subjectsCount: number }> => {
      try {
        await refreshProgress();
        if (options?.force) {
          await clearAllContentCaches();
        }
        const { curriculum: remote, isOffline: offline } = await syncCurriculumWithServer(options?.force);
        setCurriculum(remote);
        setIsOffline(offline);
        return {
          isOffline: offline,
          languagesCount: remote.languages.length,
          subjectsCount: remote.subjects.length,
        };
      } catch {
        setIsOffline(true);
        return {
          isOffline: true,
          languagesCount: curriculum.languages.length,
          subjectsCount: curriculum.subjects.length,
        };
      }
    },
    [refreshProgress, curriculum]
  );

  const clearCache = useCallback(async () => {
    try {
      await clearAllContentCaches();
      await clearCurriculumCache();
      setCurriculum(DEFAULT_CURRICULUM_SEED);
      await refreshProgress();
    } catch {
      // ignore
    }
  }, [refreshProgress]);

  useEffect(() => {
    let isMounted = true;

    async function initCurriculum() {
      try {
        await refreshProgress();

        // 1. Instantly load local cached storage so UI is interactive without network wait
        const cached = await loadCachedCurriculum();
        if (isMounted) {
          setCurriculum(cached);
        }

        // 2. Fetch fresh updates from API
        const { curriculum: remote, isOffline: offline } = await syncCurriculumWithServer();
        if (isMounted) {
          setCurriculum(remote);
          setIsOffline(offline);
        }
      } catch {
        if (isMounted) {
          setIsOffline(true);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initCurriculum();

    return () => {
      isMounted = false;
    };
  }, [refreshProgress]);

  const languages = useMemo(() => curriculum.languages, [curriculum]);
  const subjects = useMemo(() => curriculum.subjects, [curriculum]);
  const labExamples = useMemo(() => curriculum.labExamples, [curriculum]);

  // Dynamically compute real active courses reflecting current progress, recent studies, and user dismissals
  const activeCourses = useMemo(() => {
    return buildDynamicActiveCourses(
      curriculum.languages,
      curriculum.subjects,
      completedTopicIds,
      recentStudies,
      dismissedTrackIds
    );
  }, [curriculum.languages, curriculum.subjects, completedTopicIds, recentStudies, dismissedTrackIds]);

  // Remove a course from "Continue Studying"
  const removeActiveCourse = useCallback(
    async (trackId: string, category: 'language' | 'subject') => {
      try {
        let topicIds: string[] = [];
        if (category === 'language') {
          const rm = curriculum.languages.find((l) => l.id === trackId);
          if (rm) topicIds = getAllTopics(rm).map((t) => t.id);
        } else {
          const subj = curriculum.subjects.find((s) => s.id === trackId);
          if (subj) topicIds = getAllSubjectTopics(subj).map((t) => t.id);
        }

        await dismissTrackFromActiveStudies(trackId, topicIds);
        await refreshProgress();
      } catch (err) {
        console.warn('[CurriculumContext] Failed to remove active course:', err);
      }
    },
    [curriculum.languages, curriculum.subjects, refreshProgress]
  );

  // Aggregate math topics across all academic subjects (e.g. Discrete Math)
  const mathTopics = useMemo(() => {
    const mathSubj = curriculum.subjects.find((s) => s.id === 'math');
    return mathSubj ? mathSubj.topics : curriculum.subjects[0]?.topics || [];
  }, [curriculum]);

  return (
    <CurriculumContext.Provider
      value={{
        curriculum,
        languages,
        subjects,
        mathTopics,
        activeCourses,
        labExamples,
        isLoading,
        isOffline,
        refreshCurriculum,
        refreshProgress,
        clearCache,
        removeActiveCourse,
      }}>
      {children}
    </CurriculumContext.Provider>
  );
}

export function useCurriculum() {
  return useContext(CurriculumContext);
}
