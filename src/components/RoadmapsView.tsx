import React, { useState, useEffect, useMemo } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/context/ThemeContext';
import { AppTab } from './BottomNavBar';
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
  isLessonCompleted,
  calculateLanguageProgress,
  recordLastVisitedTopic,
} from '@/services/progressService';
import { MarkdownContentView } from './MarkdownContentView';
import { CodeLabModal } from './CodeLabModal';
import { getTopicContent, getCodeLabItem } from '@/services/contentService';
import { CodeLabModalData } from '@/data/roadmaps/types';

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

export function RoadmapsView({
  onNavigateTab,
  initialLanguageId,
  initialTopicId,
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
  const { languages, isLoading, isOffline, refreshCurriculum } = useCurriculum();

  // Navigation State within Roadmaps
  // null = Languages list; string = Language Chapters view; topicId = Topic Study Detail view
  const [selectedLanguageId, setSelectedLanguageId] = useState<string | null>(
    initialLanguageId || null
  );
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(
    initialTopicId || null
  );
  const [completedTopicIds, setCompletedTopicIds] = useState<string[]>([]);

  // Current selected entities
  const currentRoadmap = (languages || []).find((r) => r.id === selectedLanguageId);
  const topicData = currentRoadmap && selectedTopicId ? findTopicById(currentRoadmap, selectedTopicId) : undefined;
  const currentTopic = topicData?.topic;
  const currentChapter = topicData?.chapter;

  // Topic Markdown Content State
  const [topicMarkdown, setTopicMarkdown] = useState<string>('');
  const [isLoadingMarkdown, setIsLoadingMarkdown] = useState(false);

  // CodeLab Down-to-Up Modal State
  const [showCodeLabModal, setShowCodeLabModal] = useState(false);
  const [activeCodeLabData, setActiveCodeLabData] = useState<CodeLabModalData | null>(null);
  const [isLoadingCodeLab, setIsLoadingCodeLab] = useState(false);

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

  const handleOpenCodeLab = (codeId: string) => {
    if (!currentRoadmap) return;
    setShowCodeLabModal(true);
    setIsLoadingCodeLab(true);
    getCodeLabItem(currentRoadmap.id, codeId)
      .then((data) => {
        setActiveCodeLabData(data);
      })
      .catch(() => {
        setActiveCodeLabData({
          codeId,
          title: codeId.replace(/_/g, ' '),
          language: currentRoadmap.id,
          code: currentTopic?.codeSnippet || '// Live code snippet',
          output: currentTopic?.output || 'Terminal output',
          howItWorks: currentTopic?.howItWorks || [],
        });
      })
      .finally(() => {
        setIsLoadingCodeLab(false);
      });
  };

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  type RoadmapFilter = 'all' | 'in_progress' | 'completed' | 'not_started';
  const [selectedFilter, setSelectedFilter] = useState<RoadmapFilter>('all');

  // Multi-tier Android hardware Back button handling
  useEffect(() => {
    if (!selectedLanguageId && !selectedTopicId && !searchQuery && selectedFilter === 'all') return;

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedTopicId) {
        // Return from Topic Study Detail to Language Chapters view
        setSelectedTopicId(null);
        return true;
      }
      if (selectedLanguageId) {
        // Return from Language Chapters to Roadmaps List
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
      return false;
    });

    return () => sub.remove();
  }, [selectedLanguageId, selectedTopicId, searchQuery, selectedFilter]);

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

  // Filtered roadmaps list
  const filteredRoadmaps = useMemo(() => {
    const list = languages || [];
    return list.filter((rm) => {
      const prog = calculateLanguageProgress(rm, completedTopicIds);
      if (selectedFilter === 'in_progress' && (prog.completed === 0 || prog.isCompleted)) {
        return false;
      }
      if (selectedFilter === 'completed' && !prog.isCompleted) {
        return false;
      }
      if (selectedFilter === 'not_started' && prog.completed > 0) {
        return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();

      if (
        rm.name.toLowerCase().includes(q) ||
        rm.badge.toLowerCase().includes(q) ||
        rm.description.toLowerCase().includes(q)
      ) {
        return true;
      }

      const topics = getAllTopics(rm);
      return topics.some(
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

  const handleToggleComplete = async (topicId: string) => {
    const updated = await toggleLessonCompletion(topicId);
    setCompletedTopicIds(updated);
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
              borderBottomColor: colors.border,
              backgroundColor: colors.card,
            },
          ]}>
          <Pressable
            onPress={() => setSelectedTopicId(null)}
            style={({ pressed }) => [
              styles.backBtnPill,
              { backgroundColor: colors.cardSecondary, borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}>
            <Ionicons name="chevron-back" size={17} color={colors.text} />
            <Text style={[styles.backBtnText, { color: colors.text }]}>Back</Text>
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
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 90 },
          ]}
          showsVerticalScrollIndicator={false}>
          {/* Chapter Breadcrumb & Tag */}
          {currentChapter && (
            <View style={styles.topicBreadcrumbRow}>
              <View style={[styles.chapterPill, { backgroundColor: `${currentRoadmap.color}18` }]}>
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
                Loading topic materials...
              </Text>
            </View>
          ) : (
            <MarkdownContentView
              content={topicMarkdown}
              colors={colors}
              isDark={isDark}
              accentColor={currentRoadmap.color}
              onOpenCodeLab={handleOpenCodeLab}
            />
          )}

          {/* Previous / Next Topic Navigation Bar */}
          <View style={styles.paginationRow}>
            {prevTopic ? (
              <Pressable
                onPress={() => setSelectedTopicId(prevTopic.id)}
                style={[
                  styles.navPageBtn,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}>
                <Ionicons name="arrow-back" size={14} color={colors.primary} />
                <View style={{ flex: 1 }}>
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
                onPress={() => setSelectedTopicId(nextTopic.id)}
                style={[
                  styles.navPageBtn,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={[styles.navPageSub, { color: colors.textMuted }]}>NEXT TOPIC</Text>
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

        {/* Down-to-Up CodeLab Modal */}
        <CodeLabModal
          visible={showCodeLabModal}
          codeLabData={activeCodeLabData}
          isLoading={isLoadingCodeLab}
          onClose={() => setShowCodeLabModal(false)}
          colors={colors}
          isDark={isDark}
        />
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
              borderBottomColor: colors.border,
              backgroundColor: colors.card,
            },
          ]}>
          <Pressable
            onPress={() => setSelectedLanguageId(null)}
            style={({ pressed }) => [
              styles.backBtnPill,
              { backgroundColor: colors.cardSecondary, borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}>
            <Ionicons name="chevron-back" size={17} color={colors.text} />
            <Text style={[styles.backBtnText, { color: colors.text }]}>Roadmaps</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 80 },
          ]}
          showsVerticalScrollIndicator={false}>
          {/* Track Hero Banner */}
          <View
            style={[
              styles.trackBanner,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}>
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
                      style={{ width: 18, height: 18 }}
                      resizeMode="contain"
                    />
                  ) : (
                    <Ionicons
                      name={currentRoadmap.icon as any}
                      size={16}
                      color={currentRoadmap.color}
                    />
                  )}
                </View>
                <View style={[styles.bannerBadge, { backgroundColor: `${currentRoadmap.color}18` }]}>
                  <Text style={[styles.bannerBadgeText, { color: currentRoadmap.color }]}>
                    {currentRoadmap.badge}
                  </Text>
                </View>
              </View>
              <Text style={[styles.lessonCountText, { color: colors.textMuted }]}>
                {trackProgress.completed}/{trackProgress.total} TOPICS COMPLETED ({trackProgress.percent}%)
              </Text>
            </View>

            <Text style={[styles.trackName, { color: colors.text }]}>{currentRoadmap.name}</Text>
            <Text style={[styles.trackDesc, { color: colors.textSecondary }]}>
              {currentRoadmap.description}
            </Text>

            {/* Progress Bar */}
            <View style={[styles.progressBarBg, { backgroundColor: colors.cardSecondary }]}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${trackProgress.percent}%`, backgroundColor: currentRoadmap.color },
                ]}
              />
            </View>
          </View>

          {/* Chapters and Subtopics */}
          <View style={styles.chaptersList}>
            {chapters.map((chapter, chIdx) => {
              const chapterTopics = chapter.topics || [];
              const chapterCompleted = chapterTopics.filter((t) => completedTopicIds.includes(t.id)).length;
              const isChapterDone = chapterTopics.length > 0 && chapterCompleted === chapterTopics.length;

              return (
                <View
                  key={chapter.id}
                  style={[
                    styles.chapterCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}>
                  {/* Chapter Header */}
                  <View style={styles.chapterHeader}>
                    <View style={[styles.chapterNumberBadge, { backgroundColor: colors.cardSecondary }]}>
                      <Text style={[styles.chapterNumberText, { color: colors.primary }]}>
                        0{chIdx + 1}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.chapterTitle, { color: colors.text }]}>{chapter.title}</Text>
                      {chapter.description ? (
                        <Text style={[styles.chapterSubDesc, { color: colors.textMuted }]} numberOfLines={1}>
                          {chapter.description}
                        </Text>
                      ) : null}
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
                        {chapterCompleted}/{chapterTopics.length}
                      </Text>
                    </View>
                  </View>

                  {/* Subtopics List */}
                  <View style={styles.subtopicsContainer}>
                    {chapterTopics.map((topic, tpIdx) => {
                      const isTopicDone = isLessonCompleted(topic.id, completedTopicIds);

                      return (
                        <Pressable
                          key={topic.id}
                          onPress={() => setSelectedTopicId(topic.id)}
                          style={({ pressed }) => [
                            styles.subtopicRow,
                            { borderBottomColor: colors.borderSubtle },
                            tpIdx === chapterTopics.length - 1 && { borderBottomWidth: 0 },
                            pressed && { backgroundColor: colors.cardSecondary },
                          ]}>
                          {/* Completion Indicator */}
                          <View style={styles.subtopicLeft}>
                            <Pressable
                              onPress={() => handleToggleComplete(topic.id)}
                              hitSlop={8}
                              style={styles.topicCheckTrigger}>
                              <Ionicons
                                name={isTopicDone ? 'checkmark-circle' : 'ellipse-outline'}
                                size={20}
                                color={isTopicDone ? '#10B981' : colors.textMuted}
                              />
                            </Pressable>

                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.subtopicTitle,
                                  { color: colors.text },
                                  isTopicDone && { color: colors.textSecondary },
                                ]}>
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
                            <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
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
      {/* Top Header: icon with text Roadmaps & tagline */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, 16),
            borderBottomColor: colors.border,
            backgroundColor: colors.card,
          },
        ]}>
        <View style={styles.headerTitleRow}>
          <View style={[styles.iconBadge, { backgroundColor: colors.primaryBg }]}>
            <Ionicons name="map" size={21} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Roadmaps</Text>
            <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
              Structured learning tracks to master computer science & systems engineering
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 80 },
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Search Input Bar */}
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}>
          <Ionicons name="search" size={17} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search languages, topics, concepts..."
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

        {/* Filter Pills */}
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
                      pressed && { opacity: 0.85, borderColor: language.color },
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
                          name={isDone ? 'checkmark-circle' : 'document-text-outline'}
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
                          <Text
                            style={[styles.matchingTopicChapter, { color: colors.textMuted }]}
                            numberOfLines={1}>
                            • {chapterTitle}
                          </Text>
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
            PROGRAMMING LANGUAGES ({filteredRoadmaps.length})
          </Text>
          {isOffline && (
            <View style={[styles.offlinePill, { backgroundColor: colors.cardSecondary }]}>
              <Ionicons name="cloud-offline-outline" size={12} color={colors.textMuted} />
              <Text style={[styles.offlinePillText, { color: colors.textMuted }]}>Cached</Text>
            </View>
          )}
        </View>

        {/* Loading Spinner if API fetch is in progress and cache is empty */}
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
              <Ionicons name="search-outline" size={28} color={colors.textMuted} />
            </View>
            <Text style={[styles.emptyFilterTitle, { color: colors.text }]}>No matching tracks</Text>
            <Text style={[styles.emptyFilterSub, { color: colors.textSecondary }]}>
              {searchQuery
                ? `We couldn't find any language tracks or topics matching "${searchQuery}".`
                : 'No programming roadmaps match the selected filter.'}
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
              <Text style={styles.clearFilterBtnText}>Reset Filters</Text>
            </Pressable>
          </View>
        ) : null}

        {/* List of Programming Languages Cards */}
        <View style={styles.languageList}>
          {filteredRoadmaps.map((rm) => {
            const progress = calculateLanguageProgress(rm, completedTopicIds);
            const chaptersCount = rm.chapters ? rm.chapters.length : 1;

            return (
              <Pressable
                key={rm.id}
                onPress={() => setSelectedLanguageId(rm.id)}
                style={({ pressed }) => [
                  styles.languageCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: progress.isCompleted
                      ? 'rgba(16, 185, 129, 0.45)'
                      : colors.border,
                  },
                  pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
                ]}>
                {/* Language Card Top Row */}
                <View style={styles.cardTopRow}>
                  {/* Language Icon Badge */}
                  <View
                    style={[
                      styles.langIconBox,
                      {
                        backgroundColor: `${rm.color}18`,
                        borderColor: `${rm.color}40`,
                      },
                    ]}>
                    {isIconUrl(rm.icon) ? (
                      <Image
                        source={{ uri: rm.icon }}
                        style={{ width: 28, height: 28 }}
                        resizeMode="contain"
                      />
                    ) : (
                      <Ionicons name={rm.icon as any} size={24} color={rm.color} />
                    )}
                  </View>

                  {/* Language Name & Badges */}
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameBadgeRow}>
                      <Text style={[styles.languageName, { color: colors.text }]}>{rm.name}</Text>
                      <View style={[styles.badgePill, { backgroundColor: `${rm.color}18` }]}>
                        <Text style={[styles.badgePillText, { color: rm.color }]}>{rm.badge}</Text>
                      </View>
                    </View>
                    <Text style={[styles.languageDesc, { color: colors.textSecondary }]}>
                      {rm.description}
                    </Text>
                  </View>

                  <View style={styles.chevronWrap}>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </View>
                </View>

                {/* Progress Bar & Footer */}
                <View style={[styles.cardDivider, { backgroundColor: colors.borderSubtle }]} />

                <View style={styles.cardFooter}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <View style={styles.footerMetaRow}>
                      <Text style={[styles.progressCountText, { color: colors.textMuted }]}>
                        {chaptersCount} {chaptersCount === 1 ? 'Chapter' : 'Chapters'} • {progress.completed}/{progress.total} Topics
                      </Text>
                      <Text style={[styles.progressPercentText, { color: rm.color }]}>
                        {progress.percent}%
                      </Text>
                    </View>

                    <View style={[styles.cardProgressBarBg, { backgroundColor: colors.cardSecondary }]}>
                      <View
                        style={[
                          styles.cardProgressBarFill,
                          { width: `${progress.percent}%`, backgroundColor: rm.color },
                        ]}
                      />
                    </View>
                  </View>

                  {/* Status Tag Pill */}
                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: progress.isCompleted
                          ? 'rgba(16, 185, 129, 0.14)'
                          : progress.percent > 0
                          ? 'rgba(56, 189, 248, 0.12)'
                          : colors.cardSecondary,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.statusPillText,
                        {
                          color: progress.isCompleted
                            ? '#10B981'
                            : progress.percent > 0
                            ? colors.primary
                            : colors.textMuted,
                        },
                      ]}>
                      {progress.isCompleted
                        ? 'COMPLETED'
                        : progress.percent > 0
                        ? 'IN PROGRESS'
                        : 'START TRACK'}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.heading,
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  headerSub: {
    fontFamily: Fonts.body,
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  scrollContent: {
    paddingHorizontal: 18,
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
    fontFamily: Fonts.body,
    fontSize: 12.5,
    fontWeight: '600',
  },
  filterChipCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  filterChipCountText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
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
    fontSize: 16,
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
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  emptyFilterIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyFilterTitle: {
    fontFamily: Fonts.heading,
    fontSize: 17,
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
    borderRadius: 20,
  },
  clearFilterBtnText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },

  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },

  // Section Header
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sectionHeading: {
    fontFamily: Fonts.mono,
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  offlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  offlinePillText: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    fontWeight: '600',
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
    borderRadius: 18,
    padding: 16,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  chevronWrap: {
    paddingTop: 4,
  },
  langIconBox: {
    width: 48,
    height: 48,
    borderRadius: 15,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  languageName: {
    fontFamily: Fonts.heading,
    fontSize: 17,
    fontWeight: '800',
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
  cardDivider: {
    height: 1,
    marginVertical: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressCountText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
  },
  progressPercentText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
  },
  cardProgressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  cardProgressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusPillText: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  // Detail View Header
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 10,
  },
  backBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  backBtnText: {
    fontFamily: Fonts.heading,
    fontSize: 13,
    fontWeight: '700',
  },
  headerCompleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  headerCompleteText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
  },

  // Detail Track Banner
  trackBanner: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  bannerTagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bannerTagLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
  },
  bannerBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  lessonCountText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '600',
  },
  trackName: {
    fontFamily: Fonts.heading,
    fontSize: 21,
    fontWeight: '800',
    marginBottom: 4,
  },
  trackDesc: {
    fontFamily: Fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },

  // Chapters & Topics List
  chaptersList: {
    gap: 16,
  },
  chapterCard: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  chapterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  chapterNumberBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  chapterNumberText: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    fontWeight: '800',
  },
  chapterTitle: {
    fontFamily: Fonts.heading,
    fontSize: 16,
    fontWeight: '700',
  },
  chapterSubDesc: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    marginTop: 2,
  },
  chapterBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  chapterBadgePillText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
  },
  subtopicsContainer: {
    paddingHorizontal: 8,
  },
  subtopicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderRadius: 10,
  },
  subtopicLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  topicCheckTrigger: {
    padding: 2,
  },
  subtopicTitle: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  subtopicMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  subtopicTagText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
  },
  subtopicChevronCol: {
    paddingLeft: 4,
  },

  // Topic Study Detail View
  topicBreadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  chapterPill: {
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
    marginBottom: 12,
  },
  summaryCard: {
    borderWidth: 1,
    borderLeftWidth: 3.5,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  summaryCardTitle: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  summaryCardText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    lineHeight: 19,
  },
  contentCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionHeadingText: {
    fontFamily: Fonts.heading,
    fontSize: 15,
    fontWeight: '700',
  },
  explanationText: {
    fontFamily: Fonts.body,
    fontSize: 13.5,
    lineHeight: 22,
  },

  // Code Card
  codeCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  codeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  codeLangBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codeLangText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  copyCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  copyCodeText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: '#94A3B8',
  },
  codeText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: '#38BDF8',
    lineHeight: 18,
  },

  // Output Box
  outputBox: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  outputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  outputHeaderText: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    color: '#10B981',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  outputText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: '#E2E8F0',
    lineHeight: 17,
  },

  // Steps
  stepsList: {
    gap: 10,
  },
  stepItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepBulletCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepBulletNum: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '800',
  },
  stepItemText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },

  // Pagination Next / Prev
  paginationRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  navPageBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  navPageSub: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '700',
  },
  navPageTitle: {
    fontFamily: Fonts.heading,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  topicLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  topicLoadingText: {
    fontFamily: Fonts.body,
    fontSize: 14,
  },
});
