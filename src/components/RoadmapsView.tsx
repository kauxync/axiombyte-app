import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  BackHandler,
  TextInput,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/context/ThemeContext';
import { AppTab } from './BottomNavBar';
import { useAuth } from '@/context/AuthContext';
import { useCurriculum } from '@/context/CurriculumContext';
import {
  LanguageRoadmap,
  RoadmapTopic,
  getAllTopics,
  findTopicById,
} from '@/data/roadmaps';
import {
  loadCompletedLessonIds,
  toggleLessonCompletion,
  markLessonCompleted,
  isLessonCompleted,
  calculateLanguageProgress,
  recordLastVisitedTopic,
} from '@/services/progressService';
import { MarkdownContentView } from './MarkdownContentView';
import { getTopicContent } from '@/services/contentService';

export type { LanguageRoadmap, RoadmapTopic, RoadmapChapter } from '@/data/roadmaps';

export function isIconUrl(icon?: string): boolean {
  if (!icon) return false;
  return (
    icon.startsWith('http://') ||
    icon.startsWith('https://') ||
    icon.startsWith('data:') ||
    icon.startsWith('file://') ||
    icon.includes('/')
  );
}

function AnimatedCard({
  children,
  onPress,
  style,
  index = 0,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: any;
  index?: number;
}) {
  const [scaleAnim] = useState(() => new Animated.Value(1));
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [translateYAnim] = useState(() => new Animated.Value(16));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 260,
        delay: Math.min(index * 35, 240),
        useNativeDriver: true,
      }),
      Animated.spring(translateYAnim, {
        toValue: 0,
        friction: 8,
        tension: 45,
        delay: Math.min(index * 35, 240),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, translateYAnim, index]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[
        {
          opacity: fadeAnim,
          transform: [{ translateY: translateYAnim }, { scale: scaleAnim }],
        },
      ]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={style}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

export function RoadmapsView({
  onNavigateTab,
  initialLanguageId,
  initialTopicId,
  onGoBack,
  canGoBack,
}: {
  onNavigateTab?: (
    tab: AppTab,
    params?: { languageId?: string; subjectId?: string; topicId?: string }
  ) => void;
  initialLanguageId?: string;
  initialTopicId?: string;
  onGoBack?: () => void;
  canGoBack?: boolean;
} = {}) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const { languages, isLoading, isOffline, refreshCurriculum, refreshProgress } = useCurriculum();
  const { recordStreakActivity } = useAuth();

  // Navigation State within Roadmaps
  const [selectedLanguageId, setSelectedLanguageId] = useState<string | null>(
    initialLanguageId || null
  );
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(
    initialTopicId || null
  );
  const [completedTopicIds, setCompletedTopicIds] = useState<string[]>([]);

  // Adjust state during render if initial navigation props change (React 19 pattern)
  const [prevInitialLanguageId, setPrevInitialLanguageId] = useState(initialLanguageId);
  if (initialLanguageId !== prevInitialLanguageId) {
    setPrevInitialLanguageId(initialLanguageId);
    if (initialLanguageId) {
      setSelectedLanguageId(initialLanguageId);
    }
  }

  const [prevInitialTopicId, setPrevInitialTopicId] = useState(initialTopicId);
  if (initialTopicId !== prevInitialTopicId) {
    setPrevInitialTopicId(initialTopicId);
    if (initialTopicId) {
      setSelectedTopicId(initialTopicId);
    }
  }

  // Current selected entities
  const currentRoadmap = (languages || []).find((r) => r.id === selectedLanguageId);
  const topicData = currentRoadmap && selectedTopicId ? findTopicById(currentRoadmap, selectedTopicId) : undefined;
  const currentTopic = topicData?.topic;
  const currentChapter = topicData?.chapter;

  // Topic Markdown Content State
  const [topicMarkdown, setTopicMarkdown] = useState<string>('');
  const [isLoadingMarkdown, setIsLoadingMarkdown] = useState(false);

  // Load persistent completed topics on mount
  useEffect(() => {
    loadCompletedLessonIds().then(setCompletedTopicIds);
  }, []);

  // Fetch Topic Markdown when selectedTopic changes
  useEffect(() => {
    let isCancelled = false;

    if (!currentTopic || !currentRoadmap) {
      return;
    }

    recordLastVisitedTopic(currentRoadmap.id, 'language', currentTopic.id);

    const path =
      currentTopic.links ||
      `/${currentRoadmap.id}/${currentChapter?.id || 'ch'}/${currentTopic.id}`;

    Promise.resolve().then(async () => {
      if (isCancelled) return;
      setIsLoadingMarkdown(true);
      try {
        const md = await getTopicContent(path);
        if (!isCancelled) {
          setTopicMarkdown(md);
        }
      } catch {
        if (!isCancelled) {
          setTopicMarkdown(
            currentTopic.explanation ||
              currentTopic.summary ||
              `# ${currentTopic.title}\n\nContent could not be loaded.`
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingMarkdown(false);
        }
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [selectedTopicId, currentRoadmap, currentTopic, currentChapter?.id]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  type RoadmapFilter = 'all' | 'in_progress' | 'completed' | 'not_started';
  const [selectedFilter, setSelectedFilter] = useState<RoadmapFilter>('all');

  // Multi-tier Android hardware Back button handling
  useEffect(() => {
    if (!selectedLanguageId && !selectedTopicId && !searchQuery && selectedFilter === 'all') return;

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedTopicId) {
        setSelectedTopicId(null);
        return true;
      }
      if (selectedLanguageId) {
        setSelectedLanguageId(null);
        return true;
      }
      if (searchQuery) {
        setSearchQuery('');
        return true;
      }
      if (selectedFilter !== 'all') {
        setSelectedFilter('all');
        return true;
      }
      if (canGoBack && onGoBack) {
        onGoBack();
        return true;
      }
      return false;
    });

    return () => sub.remove();
  }, [selectedLanguageId, selectedTopicId, searchQuery, selectedFilter, canGoBack, onGoBack]);

  // Filter counts
  const filterCounts = useMemo(() => {
    let inProgress = 0;
    let completed = 0;
    let notStarted = 0;
    (languages || []).forEach((rm) => {
      const prog = calculateLanguageProgress(rm, completedTopicIds);
      if (prog.isCompleted) completed++;
      else if (prog.completed > 0) inProgress++;
      else notStarted++;
    });
    return {
      all: (languages || []).length,
      in_progress: inProgress,
      completed,
      not_started: notStarted,
    };
  }, [languages, completedTopicIds]);

  // Overall curriculum stats for roadmaps
  const overallRoadmapsStats = useMemo(() => {
    let totalTopics = 0;
    let completedTopics = 0;
    let masteredLanguages = 0;
    (languages || []).forEach((rm) => {
      const prog = calculateLanguageProgress(rm, completedTopicIds);
      totalTopics += prog.total;
      completedTopics += prog.completed;
      if (prog.isCompleted) masteredLanguages++;
    });
    const percent = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
    return {
      totalLanguages: (languages || []).length,
      totalTopics,
      completedTopics,
      masteredLanguages,
      percent,
    };
  }, [languages, completedTopicIds]);

  // Filtered roadmaps
  const filteredRoadmaps = useMemo(() => {
    return (languages || []).filter((rm) => {
      const prog = calculateLanguageProgress(rm, completedTopicIds);
      const isCompleted = prog.isCompleted;
      const inProgress = prog.completed > 0 && !isCompleted;
      const notStarted = prog.completed === 0;

      if (selectedFilter === 'in_progress' && !inProgress) return false;
      if (selectedFilter === 'completed' && !isCompleted) return false;
      if (selectedFilter === 'not_started' && !notStarted) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();

      if (
        rm.name.toLowerCase().includes(q) ||
        rm.badge.toLowerCase().includes(q) ||
        rm.description.toLowerCase().includes(q)
      ) {
        return true;
      }

      const allTopics = getAllTopics(rm);
      return allTopics.some(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.tag && t.tag.toLowerCase().includes(q)) ||
          (t.summary && t.summary.toLowerCase().includes(q))
      );
    });
  }, [languages, completedTopicIds, selectedFilter, searchQuery]);

  // Matching individual topics when search query is active
  const matchingTopics = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    const results: {
      topic: RoadmapTopic;
      language: LanguageRoadmap;
      chapterTitle: string;
    }[] = [];

    (languages || []).forEach((rm) => {
      (rm.chapters || []).forEach((ch) => {
        (ch.topics || []).forEach((t) => {
          if (
            t.title.toLowerCase().includes(q) ||
            (t.tag && t.tag.toLowerCase().includes(q)) ||
            (t.summary && t.summary.toLowerCase().includes(q))
          ) {
            results.push({
              topic: t,
              language: rm,
              chapterTitle: ch.title,
            });
          }
        });
      });
    });

    return results;
  }, [searchQuery, languages]);

  const hasScrolledDownRef = useRef(false);

  useEffect(() => {
    hasScrolledDownRef.current = false;
  }, [selectedTopicId]);

  const handleAutoMarkComplete = useCallback(async (topicId: string) => {
    if (!topicId) return;
    const { updated, newlyCompleted } = await markLessonCompleted(topicId);
    if (newlyCompleted) {
      setCompletedTopicIds(updated);
      refreshProgress().catch(() => {});
      recordStreakActivity().catch(() => {});
    }
  }, [refreshProgress, recordStreakActivity]);

  const handleTopicScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    
    // User must actively scroll past 150px to register reading action
    if (contentOffset.y > 150) {
      hasScrolledDownRef.current = true;
    }

    // Only mark complete if content is scrollable, user actually scrolled, and reached bottom
    const isScrollable = contentSize.height > layoutMeasurement.height + 60;
    const reachedBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 40;

    if (
      selectedTopicId &&
      isScrollable &&
      hasScrolledDownRef.current &&
      reachedBottom
    ) {
      handleAutoMarkComplete(selectedTopicId);
    }
  };

  const handleNavigateNextTopic = async (nextId: string) => {
    const readTopicId = selectedTopicId;
    if (readTopicId) {
      await handleAutoMarkComplete(readTopicId);
    }
    setSelectedTopicId(nextId);
  };

  const handleToggleComplete = async (topicId: string) => {
    const wasCompleted = completedTopicIds.includes(topicId);
    const updated = await toggleLessonCompletion(topicId);
    setCompletedTopicIds(updated);
    refreshProgress().catch(() => {});
    if (!wasCompleted) {
      recordStreakActivity().catch(() => {});
    }
  };

  // -------------------------------------------------------------
  // VIEW 3: IN-DEPTH TOPIC STUDY DETAIL PAGE
  // -------------------------------------------------------------
  if (selectedLanguageId && currentRoadmap && selectedTopicId && currentTopic) {
    const isCompleted = isLessonCompleted(currentTopic.id, completedTopicIds);
    const allLanguageTopics = getAllTopics(currentRoadmap);
    const currentTopicIndex = allLanguageTopics.findIndex((t) => t.id === currentTopic.id);
    const prevTopic = currentTopicIndex > 0 ? allLanguageTopics[currentTopicIndex - 1] : null;
    const nextTopic =
      currentTopicIndex < allLanguageTopics.length - 1 ? allLanguageTopics[currentTopicIndex + 1] : null;

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Detail Header with Back Navigation */}
        <View
          style={[
            styles.detailHeader,
            {
              paddingTop: Math.max(insets.top, 16),
              borderBottomColor: colors.borderSubtle,
              backgroundColor: colors.card,
            },
          ]}>
          <Pressable
            onPress={() => setSelectedTopicId(null)}
            style={({ pressed }) => [
              styles.backBtnPill,
              { backgroundColor: colors.cardSecondary, borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
            hitSlop={8}>
            <Ionicons name="arrow-back" size={16} color={colors.text} />
            <Text style={[styles.backBtnText, { color: colors.text }]}>Chapters</Text>
          </Pressable>

          {/* Mark as Completed Action Header Button */}
          <Pressable
            onPress={() => handleToggleComplete(currentTopic.id)}
            style={({ pressed }) => [
              styles.headerCompleteBtn,
              {
                backgroundColor: isCompleted ? 'rgba(16, 185, 129, 0.16)' : colors.cardSecondary,
                borderColor: isCompleted ? '#10B981' : colors.border,
              },
              pressed && { opacity: 0.75 },
            ]}>
            <Ionicons
              name={isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
              size={17}
              color={isCompleted ? '#10B981' : colors.textMuted}
            />
            <Text
              style={[
                styles.headerCompleteText,
                { color: isCompleted ? '#10B981' : colors.text },
              ]}>
              {isCompleted ? 'Completed' : 'Mark Done'}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          key={selectedTopicId}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 90 },
          ]}
          onScroll={handleTopicScroll}
          scrollEventThrottle={200}
          showsVerticalScrollIndicator={false}>
          {/* Chapter Breadcrumb & Tag */}
          {currentChapter && (
            <View style={styles.topicBreadcrumbRow}>
              <View style={[styles.chapterPill, { backgroundColor: `${currentRoadmap.color}18`, borderColor: `${currentRoadmap.color}35`, borderWidth: 0.5 }]}>
                <Ionicons name="bookmark-outline" size={11} color={currentRoadmap.color} style={{ marginRight: 4 }} />
                <Text style={[styles.chapterPillText, { color: currentRoadmap.color }]}>
                  {currentChapter.title.toUpperCase()}
                </Text>
              </View>
            </View>
          )}

          {/* Topic Title */}
          <Text style={[styles.topicDetailTitle, { color: colors.text }]}>{currentTopic.title}</Text>

          {/* Dynamic Topic Markdown Content */}
          {isLoadingMarkdown ? (
            <View style={styles.topicLoadingContainer}>
              <ActivityIndicator size="large" color={currentRoadmap.color} />
              <Text style={[styles.topicLoadingText, { color: colors.textMuted }]}>
                Loading syntax notes & architectural deep-dive...
              </Text>
            </View>
          ) : (
            <MarkdownContentView
              content={topicMarkdown}
              colors={colors}
              isDark={isDark}
              accentColor={currentRoadmap.color}
            />
          )}

          {/* Previous / Next Topic Navigation Bar */}
          <View style={styles.paginationRow}>
            {prevTopic ? (
              <Pressable
                onPress={() => setSelectedTopicId(prevTopic.id)}
                style={({ pressed }) => [
                  styles.navPageBtn,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  pressed && { opacity: 0.75, transform: [{ scale: 0.99 }] },
                ]}>
                <Ionicons name="arrow-back" size={14} color={colors.primary} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.navPageSub, { color: colors.textMuted }]}>PREVIOUS</Text>
                  <Text style={[styles.navPageTitle, { color: colors.text }]} numberOfLines={1}>
                    {prevTopic.title}
                  </Text>
                </View>
              </Pressable>
            ) : (
              <View style={{ flex: 1 }} />
            )}

            {nextTopic ? (
              <Pressable
                onPress={() => handleNavigateNextTopic(nextTopic.id)}
                style={({ pressed }) => [
                  styles.navPageBtn,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  pressed && { opacity: 0.75, transform: [{ scale: 0.99 }] },
                ]}>
                <View style={{ flex: 1, marginRight: 8, alignItems: 'flex-end' }}>
                  <Text style={[styles.navPageSub, { color: colors.textMuted }]}>NEXT LESSON</Text>
                  <Text style={[styles.navPageTitle, { color: colors.text }]} numberOfLines={1}>
                    {nextTopic.title}
                  </Text>
                </View>
                <Ionicons name="arrow-forward" size={14} color={colors.primary} />
              </Pressable>
            ) : (
              <View style={{ flex: 1 }} />
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: LANGUAGE CHAPTERS & TOPICS ROADMAP VIEW
  // -------------------------------------------------------------
  if (selectedLanguageId && currentRoadmap) {
    const trackProgress = calculateLanguageProgress(currentRoadmap, completedTopicIds);
    const chapters = currentRoadmap.chapters || [
      {
        id: `${currentRoadmap.id}_ch_main`,
        title: 'Core Curriculum Lessons',
        description: currentRoadmap.description,
        topics: currentRoadmap.lessons || [],
      },
    ];

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header with Back to Roadmaps */}
        <View
          style={[
            styles.detailHeader,
            {
              paddingTop: Math.max(insets.top, 16),
              borderBottomColor: colors.borderSubtle,
              backgroundColor: colors.card,
            },
          ]}>
          <Pressable
            onPress={() => setSelectedLanguageId(null)}
            style={({ pressed }) => [
              styles.backBtnPill,
              { backgroundColor: colors.cardSecondary, borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
            hitSlop={8}>
            <Ionicons name="arrow-back" size={16} color={colors.text} />
            <Text style={[styles.backBtnText, { color: colors.text }]}>Roadmaps</Text>
          </Pressable>

          <View style={[styles.headerCodePill, { backgroundColor: `${currentRoadmap.color}16`, borderColor: `${currentRoadmap.color}35` }]}>
            <Text style={[styles.headerCodePillText, { color: currentRoadmap.color }]}>
              {currentRoadmap.badge}
            </Text>
          </View>
        </View>

        <ScrollView
          key={selectedLanguageId}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 80 },
          ]}
          showsVerticalScrollIndicator={false}>
          {/* Track Hero Banner Card */}
          <View
            style={[
              styles.trackBanner,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}>
            <View style={[styles.cardAccentLine, { backgroundColor: currentRoadmap.color }]} />

            <View style={styles.trackBannerBody}>
              <View style={styles.bannerTagRow}>
                <View style={styles.bannerTagLeft}>
                  <View
                    style={[
                      styles.bannerIconBox,
                      {
                        backgroundColor: `${currentRoadmap.color}18`,
                        borderColor: `${currentRoadmap.color}40`,
                      },
                    ]}>
                    {isIconUrl(currentRoadmap.icon) ? (
                      <Image
                        source={{ uri: currentRoadmap.icon }}
                        style={{ width: 22, height: 22 }}
                        resizeMode="contain"
                      />
                    ) : (
                      <Ionicons
                        name={currentRoadmap.icon as any}
                        size={20}
                        color={currentRoadmap.color}
                      />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.trackName, { color: colors.text }]}>{currentRoadmap.name}</Text>
                    <View style={styles.heroSubMetaRow}>
                      <View style={[styles.bannerBadge, { backgroundColor: `${currentRoadmap.color}18`, borderColor: `${currentRoadmap.color}30`, borderWidth: 0.5 }]}>
                        <Text style={[styles.bannerBadgeText, { color: currentRoadmap.color }]}>
                          {currentRoadmap.badge}
                        </Text>
                      </View>
                      <Text style={[styles.lessonCountText, { color: colors.textMuted }]}>
                        • {trackProgress.completed}/{trackProgress.total} completed
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <Text style={[styles.trackDesc, { color: colors.textSecondary }]}>
                {currentRoadmap.description}
              </Text>

              {/* Progress Bar & Stats */}
              <View style={[styles.progressBarBg, { backgroundColor: colors.cardSecondary }]}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${trackProgress.percent}%`, backgroundColor: currentRoadmap.color },
                  ]}
                />
              </View>

              <View style={styles.trackStatsRow}>
                <Text style={[styles.trackStatsText, { color: colors.textMuted }]}>
                  Mastery Progress
                </Text>
                <Text style={[styles.trackPercentText, { color: currentRoadmap.color }]}>
                  {trackProgress.percent}%
                </Text>
              </View>
            </View>
          </View>

          {/* Section Heading: Chapters */}
          <Text style={[styles.sectionHeading, { color: colors.textMuted, marginTop: 18, marginBottom: 12 }]}>
            CURRICULUM CHECKPOINTS ({chapters.length})
          </Text>

          {/* Chapters and Subtopics */}
          <View style={styles.chaptersList}>
            {chapters.map((chapter, chIdx) => {
              const chapterTopics = chapter.topics || [];
              const chapterCompleted = chapterTopics.filter((t) => completedTopicIds.includes(t.id)).length;
              const isChapterDone = chapterTopics.length > 0 && chapterCompleted === chapterTopics.length;

              return (
                <AnimatedCard
                  key={chapter.id}
                  index={chIdx}
                  style={[
                    styles.chapterCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}>
                  {/* Chapter Header */}
                  <View style={styles.chapterHeader}>
                    <View style={[styles.chapterNumberBadge, { backgroundColor: colors.cardSecondary }]}>
                      <Text style={[styles.chapterNumberText, { color: currentRoadmap.color }]}>
                        {String(chIdx + 1).padStart(2, '0')}
                      </Text>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.chapterTitle, { color: colors.text }]}>{chapter.title}</Text>
                      <Text style={[styles.chapterSubDesc, { color: colors.textMuted }]} numberOfLines={1}>
                        {chapterTopics.length} {chapterTopics.length === 1 ? 'lesson' : 'lessons'} • Chapter {chIdx + 1}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.chapterBadgePill,
                        {
                          backgroundColor: isChapterDone
                            ? 'rgba(16, 185, 129, 0.14)'
                            : colors.cardSecondary,
                        },
                      ]}>
                      <Text
                        style={[
                          styles.chapterBadgePillText,
                          { color: isChapterDone ? '#10B981' : colors.textMuted },
                        ]}>
                        {isChapterDone
                          ? 'COMPLETE'
                          : `${chapterCompleted}/${chapterTopics.length}`}
                      </Text>
                    </View>
                  </View>

                  {/* Subtopics List */}
                  <View style={styles.subtopicsContainer}>
                    {chapterTopics.map((topic) => {
                      const isTopicDone = isLessonCompleted(topic.id, completedTopicIds);

                      return (
                        <Pressable
                          key={topic.id}
                          onPress={() => setSelectedTopicId(topic.id)}
                          style={({ pressed }) => [
                            styles.subtopicRow,
                            {
                              backgroundColor: pressed
                                ? colors.cardSecondary
                                : 'transparent',
                              borderTopColor: colors.borderSubtle,
                            },
                          ]}>
                          {/* Completion Indicator */}
                          <View style={styles.subtopicLeft}>
                            <Pressable
                              onPress={() => handleToggleComplete(topic.id)}
                              hitSlop={10}
                              style={[
                                styles.subtopicCheckBtn,
                                {
                                  backgroundColor: isTopicDone
                                    ? '#10B981'
                                    : colors.cardSecondary,
                                  borderColor: isTopicDone
                                    ? '#10B981'
                                    : colors.border,
                                },
                              ]}>
                              {isTopicDone && (
                                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                              )}
                            </Pressable>

                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.subtopicTitle,
                                  { color: colors.text },
                                  isTopicDone && { color: colors.textSecondary },
                                ]}
                                numberOfLines={1}>
                                {topic.title}
                              </Text>
                              {topic.tag ? (
                                <View style={styles.subtopicMetaRow}>
                                  <Text style={[styles.subtopicTagText, { color: currentRoadmap.color }]}>
                                    {topic.tag}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          </View>

                          <View style={styles.subtopicChevronCol}>
                            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </AnimatedCard>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  }

  // -------------------------------------------------------------
  // VIEW 1: PROGRAMMING LANGUAGES LIST (MAIN ROADMAPS SCREEN)
  // -------------------------------------------------------------
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, 16),
            borderBottomColor: colors.borderSubtle,
            backgroundColor: colors.card,
          },
        ]}>
        <View style={styles.headerTitleRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Engineering Roadmaps</Text>
            <Text style={[styles.headerSub, { color: colors.textSecondary }]} numberOfLines={1}>
              Structured systems, language syntax & architecture tracks
            </Text>
          </View>

          {isOffline && (
            <View style={[styles.headerOfflinePill, { backgroundColor: colors.cardSecondary, borderColor: colors.borderSubtle }]}>
              <Ionicons name="cloud-offline" size={12} color={colors.textMuted} />
              <Text style={[styles.headerOfflineText, { color: colors.textMuted }]}>Offline</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 84 },
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Scholar Developer Mastery Deck Card */}
        <View
          style={[
            styles.overviewStatsCard,
            {
              backgroundColor: colors.card,
              borderColor: isDark ? 'rgba(56, 189, 248, 0.35)' : colors.border,
            },
          ]}>
          <View style={[styles.cardAccentLine, { backgroundColor: colors.primary }]} />

          <View style={styles.overviewCardInner}>
            <View style={styles.overviewTopRow}>
              <View style={styles.overviewTagBadge}>
                <Ionicons name="code-slash" size={13} color={colors.primary} />
                <Text style={[styles.overviewTagText, { color: colors.primary }]}>DEVELOPER SYNTAX & SYSTEMS</Text>
              </View>

              <View style={[styles.masteryPill, { backgroundColor: 'rgba(56, 189, 248, 0.14)' }]}>
                <Text style={[styles.masteryPillText, { color: colors.primary }]}>
                  {overallRoadmapsStats.percent}% MASTERED
                </Text>
              </View>
            </View>

            {/* Micro Progress Track */}
            <View style={[styles.overviewTrackBg, { backgroundColor: colors.cardSecondary }]}>
              <View
                style={[
                  styles.overviewTrackFill,
                  { width: `${overallRoadmapsStats.percent}%`, backgroundColor: colors.primary },
                ]}
              />
            </View>

            {/* 3 Metrics Capsule Row */}
            <View style={[styles.metricsCapsuleRow, { backgroundColor: colors.cardSecondary, borderColor: colors.borderSubtle }]}>
              <View style={styles.metricColumn}>
                <Text style={[styles.metricBigNumber, { color: colors.text }]}>
                  {overallRoadmapsStats.totalLanguages}
                </Text>
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Tracks</Text>
              </View>

              <View style={[styles.metricDivider, { backgroundColor: colors.borderSubtle }]} />

              <View style={styles.metricColumn}>
                <Text style={[styles.metricBigNumber, { color: '#10B981' }]}>
                  {overallRoadmapsStats.completedTopics}/{overallRoadmapsStats.totalTopics}
                </Text>
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Lessons Done</Text>
              </View>

              <View style={[styles.metricDivider, { backgroundColor: colors.borderSubtle }]} />

              <View style={styles.metricColumn}>
                <Text style={[styles.metricBigNumber, { color: '#F59E0B' }]}>
                  {overallRoadmapsStats.masteredLanguages}
                </Text>
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Completed</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Search Input Bar */}
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search languages, syntax, systems..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={17} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {/* Filter Pills with DemiBold typography */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}>
          {(
            [
              { id: 'all', label: 'All', count: filterCounts.all },
              { id: 'in_progress', label: 'In Progress', count: filterCounts.in_progress },
              { id: 'completed', label: 'Completed', count: filterCounts.completed },
              { id: 'not_started', label: 'Not Started', count: filterCounts.not_started },
            ] as const
          ).map((tab) => {
            const isSelected = selectedFilter === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setSelectedFilter(tab.id)}
                style={({ pressed }) => [
                  styles.filterChip,
                  {
                    backgroundColor: isSelected
                      ? isDark
                        ? 'rgba(56, 189, 248, 0.16)'
                        : 'rgba(14, 165, 233, 0.12)'
                      : colors.card,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                  pressed && { opacity: 0.8 },
                ]}>
                <Text
                  style={[
                    styles.filterChipText,
                    { color: isSelected ? colors.primary : colors.textSecondary },
                  ]}>
                  {tab.label}
                </Text>
                <View
                  style={[
                    styles.filterChipCountBadge,
                    {
                      backgroundColor: isSelected
                        ? isDark
                          ? 'rgba(56, 189, 248, 0.25)'
                          : 'rgba(14, 165, 233, 0.22)'
                        : colors.cardSecondary,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.filterChipCountText,
                      { color: isSelected ? colors.primary : colors.textMuted },
                    ]}>
                    {tab.count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* MATCHING TOPICS (WHEN SEARCHING) */}
        {searchQuery.trim().length > 0 && matchingTopics.length > 0 && (
          <View style={styles.matchingTopicsSection}>
            <View style={styles.matchingTopicsHeaderRow}>
              <View style={styles.matchingTopicsTitleLeft}>
                <Ionicons name="document-text" size={16} color={colors.primary} />
                <Text style={[styles.matchingTopicsHeading, { color: colors.text }]}>
                  Matching Topics
                </Text>
              </View>
              <View style={[styles.matchingCountBadge, { backgroundColor: colors.cardSecondary }]}>
                <Text style={[styles.matchingCountBadgeText, { color: colors.primary }]}>
                  {matchingTopics.length} found
                </Text>
              </View>
            </View>

            <View style={styles.matchingTopicsList}>
              {matchingTopics.map(({ topic, language, chapterTitle }) => {
                const isDone = completedTopicIds.includes(topic.id);
                return (
                  <Pressable
                    key={`${language.id}-${topic.id}`}
                    onPress={() => {
                      setSelectedLanguageId(language.id);
                      setSelectedTopicId(topic.id);
                    }}
                    style={({ pressed }) => [
                      styles.matchingTopicCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                      pressed && { opacity: 0.85, borderColor: language.color, transform: [{ scale: 0.99 }] },
                    ]}>
                    <View style={styles.matchingTopicLeft}>
                      <View
                        style={[
                          styles.matchingTopicIconBox,
                          {
                            backgroundColor: isDone
                              ? 'rgba(16, 185, 129, 0.15)'
                              : `${language.color}18`,
                          },
                        ]}>
                        <Ionicons
                          name={isDone ? 'checkmark-circle' : 'code-slash-outline'}
                          size={17}
                          color={isDone ? '#10B981' : language.color}
                        />
                      </View>
                      <View style={styles.matchingTopicInfo}>
                        <Text
                          style={[styles.matchingTopicTitle, { color: colors.text }]}
                          numberOfLines={1}>
                          {topic.title}
                        </Text>
                        <View style={styles.matchingTopicMetaRow}>
                          <View
                            style={[
                              styles.matchingTopicBadge,
                              { backgroundColor: `${language.color}18` },
                            ]}>
                            <Text
                              style={[
                                styles.matchingTopicBadgeText,
                                { color: language.color },
                              ]}>
                              {language.name}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Section Header */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>
            PROGRAMMING TRACKS ({filteredRoadmaps.length})
          </Text>
        </View>

        {/* Loading Spinner */}
        {isLoading && (!languages || languages.length === 0) ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Fetching latest curriculum from server...
            </Text>
          </View>
        ) : null}

        {/* Empty State / Offline Fallback Prompt */}
        {!isLoading && (!languages || languages.length === 0) ? (
          <View
            style={[
              styles.emptyContainer,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}>
            <Ionicons name="cloud-download-outline" size={36} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Roadmaps Loaded</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              Connect to the internet to sync and download the latest computer science curriculum tracks.
            </Text>
            <Pressable
              onPress={() => refreshCurriculum()}
              style={[styles.syncBtn, { backgroundColor: colors.primary }]}>
              <Ionicons name="refresh" size={16} color="#0F172A" />
              <Text style={styles.syncBtnText}>Sync Curriculum</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Empty Filter / Search State */}
        {filteredRoadmaps.length === 0 && matchingTopics.length === 0 && (!isLoading || (languages && languages.length > 0)) && (languages && languages.length > 0) ? (
          <View
            style={[
              styles.emptyFilterContainer,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}>
            <View style={[styles.emptyFilterIconWrap, { backgroundColor: colors.cardSecondary }]}>
              <Ionicons name="search-outline" size={26} color={colors.textMuted} />
            </View>
            <Text style={[styles.emptyFilterTitle, { color: colors.text }]}>No matching tracks</Text>
            <Text style={[styles.emptyFilterSub, { color: colors.textSecondary }]}>
              {searchQuery
                ? `We couldn't find any language tracks or topics matching "${searchQuery}".`
                : 'No programming roadmaps match the selected filter category.'}
            </Text>
            <Pressable
              onPress={() => {
                setSearchQuery('');
                setSelectedFilter('all');
              }}
              style={({ pressed }) => [
                styles.clearFilterBtn,
                { backgroundColor: colors.primary },
                pressed && { opacity: 0.85 },
              ]}>
              <Ionicons name="refresh" size={14} color="#0F172A" />
              <Text style={styles.clearFilterBtnText}>Reset Filter</Text>
            </Pressable>
          </View>
        ) : null}

        {/* List of Programming Languages Cards */}
        <View style={styles.languageList}>
          {filteredRoadmaps.map((rm, idx) => {
            const progress = calculateLanguageProgress(rm, completedTopicIds);
            const chaptersCount = rm.chapters ? rm.chapters.length : 1;
            const isCompleted = progress.isCompleted;
            const isStarted = progress.completed > 0 && !isCompleted;

            return (
              <AnimatedCard
                key={rm.id}
                index={idx}
                onPress={() => setSelectedLanguageId(rm.id)}
                style={[
                  styles.languageCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: isCompleted
                      ? 'rgba(16, 185, 129, 0.45)'
                      : colors.border,
                  },
                ]}>
                {/* Brand Color Top Accent Line */}
                <View style={[styles.cardAccentLine, { backgroundColor: rm.color }]} />

                <View style={styles.cardInnerPadding}>
                  {/* Language Card Top Row */}
                  <View style={styles.cardTopRow}>
                    <View
                      style={[
                        styles.langIconBox,
                        {
                          backgroundColor: `${rm.color}1E`,
                          borderColor: `${rm.color}35`,
                        },
                      ]}>
                      {isIconUrl(rm.icon) ? (
                        <Image
                          source={{ uri: rm.icon }}
                          style={{ width: 26, height: 26 }}
                          resizeMode="contain"
                        />
                      ) : (
                        <Ionicons name={rm.icon as any} size={22} color={rm.color} />
                      )}
                    </View>

                    <View style={{ flex: 1 }}>
                      <View style={styles.nameBadgeRow}>
                        <Text style={[styles.languageName, { color: colors.text }]}>{rm.name}</Text>
                        <View style={[styles.badgePill, { backgroundColor: `${rm.color}16`, borderColor: `${rm.color}30`, borderWidth: 0.5 }]}>
                          <Text style={[styles.badgePillText, { color: rm.color }]}>{rm.badge}</Text>
                        </View>
                      </View>
                      <Text style={[styles.languageDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                        {rm.description}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusPill,
                        isCompleted
                          ? {
                              backgroundColor: 'rgba(16, 185, 129, 0.14)',
                              borderColor: '#10B981',
                            }
                          : isStarted
                          ? {
                              backgroundColor: `${rm.color}16`,
                              borderColor: `${rm.color}40`,
                            }
                          : {
                              backgroundColor: colors.cardSecondary,
                              borderColor: colors.borderSubtle,
                            },
                      ]}>
                      <Text
                        style={[
                          styles.statusPillText,
                          {
                            color: isCompleted
                              ? '#10B981'
                              : isStarted
                              ? rm.color
                              : colors.textMuted,
                          },
                        ]}>
                        {isCompleted ? 'COMPLETED' : isStarted ? 'IN PROGRESS' : 'NOT STARTED'}
                      </Text>
                    </View>
                  </View>

                  {/* Progress Bar */}
                  <View style={[styles.cardProgressBarBg, { backgroundColor: colors.cardSecondary }]}>
                    <View
                      style={[
                        styles.cardProgressBarFill,
                        { width: `${progress.percent}%`, backgroundColor: isCompleted ? '#10B981' : rm.color },
                      ]}
                    />
                  </View>

                  {/* Card Footer */}
                  <View style={styles.cardFooter}>
                    <Text style={[styles.progressCountText, { color: colors.textMuted }]}>
                      {chaptersCount} {chaptersCount === 1 ? 'Chapter' : 'Chapters'} • {progress.completed}/{progress.total} topics
                    </Text>

                    <View style={styles.ctaPillWrap}>
                      <Text
                        style={[
                          styles.ctaPillText,
                          { color: isCompleted ? '#10B981' : rm.color },
                        ]}>
                        {isCompleted
                          ? 'Review Track ➔'
                          : isStarted
                          ? 'Resume ➔'
                          : 'Explore ➔'}
                      </Text>
                    </View>
                  </View>
                </View>
              </AnimatedCard>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// -------------------------------------------------------------
// STYLES
// -------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.heading,
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  headerSub: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    marginTop: 2,
  },
  headerOfflinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  headerOfflineText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 14,
    height: '100%',
  },

  // Filter Pills Scroll
  filterScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 16,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  filterChipText: {
    fontFamily: Fonts.headingDemiBold,
    fontSize: 12,
    letterSpacing: 0.3,
  },
  filterChipCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  filterChipCountText: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  // Matching Topics (Search results)
  matchingTopicsSection: {
    marginBottom: 20,
  },
  matchingTopicsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  matchingTopicsTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  matchingTopicsHeading: {
    fontFamily: Fonts.heading,
    fontSize: 15,
    fontWeight: '700',
  },
  matchingCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  matchingCountBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
  },
  matchingTopicsList: {
    gap: 8,
  },
  matchingTopicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 10,
  },
  matchingTopicLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  matchingTopicIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchingTopicInfo: {
    flex: 1,
    gap: 3,
  },
  matchingTopicTitle: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    fontWeight: '600',
  },
  matchingTopicMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  matchingTopicBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  matchingTopicBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    fontWeight: '700',
  },
  matchingTopicChapter: {
    fontFamily: Fonts.body,
    fontSize: 12,
    flex: 1,
  },

  // Empty Filter / Search State
  emptyFilterContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 20,
  },
  emptyFilterIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyFilterTitle: {
    fontFamily: Fonts.heading,
    fontSize: 16.5,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyFilterSub: {
    fontFamily: Fonts.body,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  clearFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
  },
  clearFilterBtnText: {
    fontFamily: Fonts.headingMedium,
    fontSize: 13,
    color: '#0F172A',
  },

  // Section Header
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeading: {
    fontFamily: Fonts.headingDemiBold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  // Scholar Mastery Overview Card
  overviewStatsCard: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
  },
  overviewCardInner: {
    padding: 18,
  },
  overviewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  overviewTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  overviewTagText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  masteryPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  masteryPillText: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  overviewTrackBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 14,
  },
  overviewTrackFill: {
    height: '100%',
    borderRadius: 3,
  },
  metricsCapsuleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  metricColumn: {
    alignItems: 'center',
    flex: 1,
  },
  metricBigNumber: {
    fontFamily: Fonts.heading,
    fontSize: 16,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    fontFamily: Fonts.body,
    fontSize: 10.5,
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 22,
  },

  // Loading & Empty States
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontFamily: Fonts.body,
    fontSize: 13,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
  },
  emptyTitle: {
    fontFamily: Fonts.heading,
    fontSize: 17,
    fontWeight: '700',
  },
  emptySub: {
    fontFamily: Fonts.body,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  syncBtnText: {
    fontFamily: Fonts.heading,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },

  // Language Cards
  languageList: {
    gap: 14,
  },
  languageCard: {
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 2,
  },
  cardAccentLine: {
    height: 3.5,
    width: '100%',
  },
  cardInnerPadding: {
    padding: 16,
  },
  sampleChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    marginBottom: 12,
  },
  sampleChipPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
    maxWidth: '48%',
  },
  sampleChipText: {
    fontFamily: Fonts.body,
    fontSize: 11,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  langIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  languageName: {
    fontFamily: Fonts.heading,
    fontSize: 16.5,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  badgePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePillText: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  languageDesc: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
  },
  cardProgressBarBg: {
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
    marginBottom: 10,
  },
  cardProgressBarFill: {
    height: '100%',
    borderRadius: 2.5,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  progressCountText: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    fontVariant: ['tabular-nums'],
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusPillText: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  ctaPillWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ctaPillText: {
    fontFamily: Fonts.headingDemiBold,
    fontSize: 12,
  },

  // ── VIEW 2: CHAPTER DETAIL VIEW ───────────────────────────
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  backBtnText: {
    fontFamily: Fonts.headingMedium,
    fontSize: 13,
  },
  headerCodePill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  headerCodePillText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '800',
  },
  headerCompleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6.5,
    borderRadius: 12,
    borderWidth: 1,
  },
  headerCompleteText: {
    fontFamily: Fonts.headingMedium,
    fontSize: 12.5,
  },
  trackBanner: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 6,
  },
  trackBannerBody: {
    padding: 18,
  },
  bannerTagRow: {
    marginBottom: 8,
  },
  bannerTagLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bannerIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSubMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  bannerBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bannerBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  lessonCountText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '600',
  },
  trackName: {
    fontFamily: Fonts.heading,
    fontSize: 16.5,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  trackDesc: {
    fontFamily: Fonts.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
    marginBottom: 12,
  },
  progressBarBg: {
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2.5,
  },
  trackStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  trackStatsText: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    fontVariant: ['tabular-nums'],
  },
  trackPercentText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  chaptersList: {
    gap: 14,
  },
  chapterCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  chapterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  chapterNumberBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chapterNumberText: {
    fontFamily: Fonts.mono,
    fontSize: 14,
    fontWeight: '800',
  },
  chapterTitle: {
    fontFamily: Fonts.heading,
    fontSize: 15.5,
    fontWeight: '700',
  },
  chapterSubDesc: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
  },
  chapterBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
  },
  chapterBadgePillText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  subtopicsContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  subtopicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  subtopicLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  subtopicCheckBtn: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subtopicTitle: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13.5,
  },
  subtopicMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  subtopicTagText: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
  },
  subtopicChevronCol: {
    paddingLeft: 4,
  },

  // ── VIEW 3: TOPIC STUDY DETAIL ────────────────────────────
  topicBreadcrumbRow: {
    marginBottom: 8,
  },
  chapterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  chapterPillText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  topicDetailTitle: {
    fontFamily: Fonts.heading,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 28,
    marginBottom: 16,
  },
  topicLoadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  topicLoadingText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
  },
  paginationRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  navPageBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  navPageSub: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  navPageTitle: {
    fontFamily: Fonts.headingMedium,
    fontSize: 13,
    marginTop: 2,
  },
});
