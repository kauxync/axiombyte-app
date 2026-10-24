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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/context/ThemeContext';
import { useCurriculum } from '@/context/CurriculumContext';
import {
  loadCompletedLessonIds,
  toggleLessonCompletion,
  markLessonCompleted,
  isLessonCompleted,
  recordLastVisitedTopic,
} from '@/services/progressService';
import {
  SubjectItem,
  SubjectTopic,
  getAllSubjectTopics,
} from '@/data/subjects';
import { MarkdownContentView } from './MarkdownContentView';
import { getTopicContent } from '@/services/contentService';

export type { SubjectItem, SubjectTopic, SubjectChapter, MathTopic } from '@/data/subjects';

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

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------
export function SubjectsNotesView({
  initialSubjectId,
  initialTopicId,
  onGoBack,
  canGoBack,
}: {
  initialSubjectId?: string;
  initialTopicId?: string;
  onGoBack?: () => void;
  canGoBack?: boolean;
} = {}) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const { subjects, isOffline, refreshProgress } = useCurriculum();
  const activeSubjects = useMemo(() => subjects || [], [subjects]);

  // Navigation states mirroring RoadmapsView pattern:
  // View 1 (Subjects List) -> View 2 (Subject Chapters) -> View 3 (Topic Study Detail)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(
    initialSubjectId || null
  );
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(
    initialTopicId || null
  );
  const [completedTopicIds, setCompletedTopicIds] = useState<string[]>([]);

  // Interactive Truth Table Simulator States
  const [valP, setValP] = useState<boolean>(true);
  const [valQ, setValQ] = useState<boolean>(false);

  // Load completed topic IDs on mount
  useEffect(() => {
    loadCompletedLessonIds().then((ids) => {
      setCompletedTopicIds(ids);
    });
  }, []);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  type SubjectFilter = 'all' | 'in_progress' | 'completed' | 'not_started';
  const [selectedFilter, setSelectedFilter] = useState<SubjectFilter>('all');

  // Multi-tier Android hardware Back button handling
  useEffect(() => {
    if (!selectedSubjectId && !selectedTopicId && !searchQuery && selectedFilter === 'all') return;

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedTopicId) {
        // Return from Topic Study Detail to Subject Chapters view
        setSelectedTopicId(null);
        return true;
      }
      if (selectedSubjectId) {
        // Return from Subject Chapters to Subjects List
        setSelectedSubjectId(null);
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
  }, [selectedSubjectId, selectedTopicId, searchQuery, selectedFilter]);

  // Filter counts
  const filterCounts = useMemo(() => {
    let inProgress = 0;
    let completed = 0;
    let notStarted = 0;
    activeSubjects.forEach((subj) => {
      const allTopics = getAllSubjectTopics(subj);
      const completedCount = allTopics.filter((t) => completedTopicIds.includes(t.id)).length;
      if (allTopics.length > 0 && completedCount === allTopics.length) {
        completed++;
      } else if (completedCount > 0) {
        inProgress++;
      } else {
        notStarted++;
      }
    });
    return {
      all: activeSubjects.length,
      in_progress: inProgress,
      completed,
      not_started: notStarted,
    };
  }, [activeSubjects, completedTopicIds]);

  // Filtered subjects list
  const filteredSubjects = useMemo(() => {
    return activeSubjects.filter((subj) => {
      const allTopics = getAllSubjectTopics(subj);
      const completedCount = allTopics.filter((t) => completedTopicIds.includes(t.id)).length;
      const isCompleted = allTopics.length > 0 && completedCount === allTopics.length;
      const inProgress = completedCount > 0 && !isCompleted;
      const notStarted = completedCount === 0;

      if (selectedFilter === 'in_progress' && !inProgress) return false;
      if (selectedFilter === 'completed' && !isCompleted) return false;
      if (selectedFilter === 'not_started' && !notStarted) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();

      if (
        subj.name.toLowerCase().includes(q) ||
        subj.badge.toLowerCase().includes(q) ||
        subj.description.toLowerCase().includes(q)
      ) {
        return true;
      }

      return allTopics.some(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.category && t.category.toLowerCase().includes(q)) ||
          (t.definition && t.definition.toLowerCase().includes(q))
      );
    });
  }, [activeSubjects, completedTopicIds, selectedFilter, searchQuery]);

  // Matching individual topics when search query is active
  const matchingTopics = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    const results: {
      topic: SubjectTopic;
      subject: SubjectItem;
      chapterTitle: string;
    }[] = [];

    activeSubjects.forEach((subj) => {
      (subj.chapters || []).forEach((ch) => {
        (ch.topics || []).forEach((t) => {
          if (
            t.title.toLowerCase().includes(q) ||
            (t.category && t.category.toLowerCase().includes(q)) ||
            (t.definition && t.definition.toLowerCase().includes(q))
          ) {
            results.push({
              topic: t,
              subject: subj,
              chapterTitle: ch.title,
            });
          }
        });
      });
    });

    return results;
  }, [searchQuery, activeSubjects]);

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
    }
  }, [refreshProgress]);

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
    // Only mark the current topic that was just read
    const readTopicId = selectedTopicId;
    if (readTopicId) {
      await handleAutoMarkComplete(readTopicId);
    }
    // Switch to next topic (which is unread)
    setSelectedTopicId(nextId);
  };

  const handleToggleComplete = async (topicId: string) => {
    const updated = await toggleLessonCompletion(topicId);
    setCompletedTopicIds(updated);
    refreshProgress().catch(() => {});
  };

  const currentSubject = activeSubjects.find((s) => s.id === selectedSubjectId);
  const currentChapter = currentSubject?.chapters.find((c) =>
    c.topics.some((t) => t.id === selectedTopicId)
  );
  const currentTopic = currentSubject
    ? getAllSubjectTopics(currentSubject).find((t) => t.id === selectedTopicId)
    : null;

  // Topic Markdown Content State
  const [topicMarkdown, setTopicMarkdown] = useState<string>('');
  const [isLoadingMarkdown, setIsLoadingMarkdown] = useState(false);

  // Fetch Topic Markdown when selectedTopic changes
  useEffect(() => {
    let isCancelled = false;

    if (!currentTopic || !currentSubject) {
      return;
    }

    recordLastVisitedTopic(currentSubject.id, 'subject', currentTopic.id);

    const path =
      currentTopic.links ||
      `/subjects/${currentSubject.id}/${currentChapter?.id || 'ch'}/${currentTopic.id}`;

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
            `# ${currentTopic.title}\n\n### Key Theorem / Formula\n\`\`\`math\n${currentTopic.latexFormula}\n\`\`\`\n\n### Formal Definition\n${currentTopic.definition}\n\n### Formal Invariants & Laws\n${currentTopic.keyProperties.map((p) => `* ${p}`).join('\n')}\n\n### Concrete Application\n${currentTopic.example}`
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
  }, [selectedTopicId, currentSubject, currentTopic, currentChapter?.id]);

  // Truth table evaluations for interactive logic lab
  const notP = !valP;
  const pAndQ = valP && valQ;
  const pOrQ = valP || valQ;
  const pImpliesQ = !valP || valQ;
  const pBicondQ = valP === valQ;

  // ---------------------------------------------------------------------------
  // VIEW 3: IN-DEPTH TOPIC STUDY DETAIL PAGE
  // ---------------------------------------------------------------------------
  if (selectedSubjectId && currentSubject && selectedTopicId && currentTopic) {
    const isCompleted = isLessonCompleted(currentTopic.id, completedTopicIds);
    const allSubjectTopics = getAllSubjectTopics(currentSubject);
    const currentTopicIndex = allSubjectTopics.findIndex((t) => t.id === currentTopic.id);
    const prevTopic = currentTopicIndex > 0 ? allSubjectTopics[currentTopicIndex - 1] : null;
    const nextTopic =
      currentTopicIndex < allSubjectTopics.length - 1
        ? allSubjectTopics[currentTopicIndex + 1]
        : null;

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
              <View style={[styles.chapterPill, { backgroundColor: `${currentSubject.color}18` }]}>
                <Text style={[styles.chapterPillText, { color: currentSubject.color }]}>
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
              <ActivityIndicator size="large" color={currentSubject.color} />
              <Text style={[styles.topicLoadingText, { color: colors.textMuted }]}>
                Loading topic materials...
              </Text>
            </View>
          ) : (
            <MarkdownContentView
              content={topicMarkdown}
              colors={colors}
              isDark={isDark}
              accentColor={currentSubject.color}
            />
          )}

          {/* Interactive Truth Table Simulator (if logic topic) */}
          {currentTopic.isInteractiveLogic && (
            <View
              style={[
                styles.simCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}>
              <View style={styles.simHeader}>
                <View style={styles.simHeaderLeft}>
                  <Ionicons name="flash" size={16} color="#F59E0B" />
                  <Text style={[styles.simTitle, { color: colors.text }]}>
                    Interactive Truth Table Lab
                  </Text>
                </View>
                <Text style={styles.simBadge}>LIVE COMPUTATION</Text>
              </View>
              <Text style={[styles.simSub, { color: colors.textSecondary }]}>
                Toggle P and Q below to see boolean logic and implication evaluate in real time:
              </Text>

              {/* Toggle Switches */}
              <View style={styles.toggleRow}>
                <Pressable
                  onPress={() => setValP(!valP)}
                  style={[
                    styles.toggleBtn,
                    {
                      backgroundColor: valP ? '#10B981' : colors.cardSecondary,
                      borderColor: valP ? '#10B981' : colors.border,
                    },
                  ]}>
                  <Text style={[styles.toggleBtnText, { color: valP ? '#0F172A' : colors.text }]}>
                    P = {valP ? 'TRUE (1)' : 'FALSE (0)'}
                  </Text>
                  <Ionicons
                    name={valP ? 'checkmark-circle' : 'close-circle'}
                    size={16}
                    color={valP ? '#0F172A' : colors.textMuted}
                  />
                </Pressable>

                <Pressable
                  onPress={() => setValQ(!valQ)}
                  style={[
                    styles.toggleBtn,
                    {
                      backgroundColor: valQ ? '#10B981' : colors.cardSecondary,
                      borderColor: valQ ? '#10B981' : colors.border,
                    },
                  ]}>
                  <Text style={[styles.toggleBtnText, { color: valQ ? '#0F172A' : colors.text }]}>
                    Q = {valQ ? 'TRUE (1)' : 'FALSE (0)'}
                  </Text>
                  <Ionicons
                    name={valQ ? 'checkmark-circle' : 'close-circle'}
                    size={16}
                    color={valQ ? '#0F172A' : colors.textMuted}
                  />
                </Pressable>
              </View>

              {/* Table Matrix */}
              <View
                style={[
                  styles.matrixTable,
                  { backgroundColor: isDark ? '#090D16' : '#1E293B' },
                ]}>
                <View style={styles.matrixRow}>
                  <Text style={styles.matrixColLabel}>¬P (NOT)</Text>
                  <Text style={styles.matrixColLabel}>P ∧ Q (AND)</Text>
                  <Text style={styles.matrixColLabel}>P ∨ Q (OR)</Text>
                  <Text style={styles.matrixColLabel}>P → Q (IMPLIES)</Text>
                  <Text style={styles.matrixColLabel}>P ↔ Q (XNOR)</Text>
                </View>
                <View style={styles.matrixValuesRow}>
                  <View style={[styles.matrixCell, notP ? styles.cellTrue : styles.cellFalse]}>
                    <Text style={styles.cellText}>{notP ? 'T' : 'F'}</Text>
                  </View>
                  <View style={[styles.matrixCell, pAndQ ? styles.cellTrue : styles.cellFalse]}>
                    <Text style={styles.cellText}>{pAndQ ? 'T' : 'F'}</Text>
                  </View>
                  <View style={[styles.matrixCell, pOrQ ? styles.cellTrue : styles.cellFalse]}>
                    <Text style={styles.cellText}>{pOrQ ? 'T' : 'F'}</Text>
                  </View>
                  <View style={[styles.matrixCell, pImpliesQ ? styles.cellTrue : styles.cellFalse]}>
                    <Text style={styles.cellText}>{pImpliesQ ? 'T' : 'F'}</Text>
                  </View>
                  <View style={[styles.matrixCell, pBicondQ ? styles.cellTrue : styles.cellFalse]}>
                    <Text style={styles.cellText}>{pBicondQ ? 'T' : 'F'}</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Navigation Controls: Previous / Next Topic */}
          <View style={styles.topicNavFooter}>
            {prevTopic ? (
              <Pressable
                onPress={() => setSelectedTopicId(prevTopic.id)}
                style={({ pressed }) => [
                  styles.topicNavBtn,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  pressed && { opacity: 0.7 },
                ]}>
                <Ionicons name="arrow-back" size={15} color={colors.primary} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.topicNavDir, { color: colors.textMuted }]}>PREVIOUS</Text>
                  <Text style={[styles.topicNavTitle, { color: colors.text }]} numberOfLines={1}>
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
                  styles.topicNavBtn,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  pressed && { opacity: 0.7 },
                ]}>
                <View style={{ flex: 1, marginRight: 8, alignItems: 'flex-end' }}>
                  <Text style={[styles.topicNavDir, { color: colors.textMuted }]}>NEXT</Text>
                  <Text style={[styles.topicNavTitle, { color: colors.text }]} numberOfLines={1}>
                    {nextTopic.title}
                  </Text>
                </View>
                <Ionicons name="arrow-forward" size={15} color={colors.primary} />
              </Pressable>
            ) : (
              <View style={{ flex: 1 }} />
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW 2: SUBJECT CHAPTERS & TOPICS (DETAIL SCREEN)
  // ---------------------------------------------------------------------------
  if (selectedSubjectId && currentSubject) {
    const allTopics = getAllSubjectTopics(currentSubject);
    const completedCount = allTopics.filter((t) => completedTopicIds.includes(t.id)).length;
    const progressPercent =
      allTopics.length > 0 ? Math.round((completedCount / allTopics.length) * 100) : 0;

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Back Header: clean back button, no subject name text (matching user spec) */}
        <View
          style={[
            styles.languageDetailHeader,
            {
              paddingTop: Math.max(insets.top, 16),
              borderBottomColor: colors.border,
              backgroundColor: colors.card,
            },
          ]}>
          <Pressable
            onPress={() => setSelectedSubjectId(null)}
            style={({ pressed }) => [
              styles.backBtnPill,
              { backgroundColor: colors.cardSecondary, borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}>
            <Ionicons name="chevron-back" size={17} color={colors.text} />
            <Text style={[styles.backBtnText, { color: colors.text }]}>Subjects Notes</Text>
          </Pressable>
        </View>

        <ScrollView
          key={selectedSubjectId}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 80 },
          ]}
          showsVerticalScrollIndicator={false}>
          {/* Subject Hero Header Card */}
          <View
            style={[
              styles.trackHeroCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}>
            <View style={styles.trackHeaderRow}>
              <View style={styles.trackLeftHeader}>
                <View
                  style={[
                    styles.trackIconWrap,
                    { backgroundColor: `${currentSubject.color}1E` },
                  ]}>
                  {isIconUrl(currentSubject.icon) ? (
                    <Image
                      source={{ uri: currentSubject.icon }}
                      style={{ width: 22, height: 22 }}
                      resizeMode="contain"
                    />
                  ) : (
                    <Ionicons
                      name={currentSubject.icon as any}
                      size={22}
                      color={currentSubject.color}
                    />
                  )}
                </View>
                <View
                  style={[
                    styles.badgePill,
                    { backgroundColor: `${currentSubject.color}18` },
                  ]}>
                  <Text style={[styles.badgeText, { color: currentSubject.color }]}>
                    {currentSubject.badge}
                  </Text>
                </View>
              </View>

              <Text style={[styles.estHoursText, { color: colors.textMuted }]}>
                {currentSubject.estHours}
              </Text>
            </View>

            <Text style={[styles.trackName, { color: colors.text }]}>{currentSubject.name}</Text>
            <Text style={[styles.trackDesc, { color: colors.textSecondary }]}>
              {currentSubject.description}
            </Text>

            {/* Progress Bar */}
            <View style={[styles.progressBarBg, { backgroundColor: colors.cardSecondary }]}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${progressPercent}%`, backgroundColor: currentSubject.color },
                ]}
              />
            </View>

            <View style={styles.trackStatsRow}>
              <Text style={[styles.trackStatsText, { color: colors.textMuted }]}>
                {completedCount} of {allTopics.length} topics completed
              </Text>
              <Text style={[styles.trackPercentText, { color: currentSubject.color }]}>
                {progressPercent}%
              </Text>
            </View>
          </View>

          {/* Chapters and Subtopics */}
          <View style={styles.chaptersList}>
            {currentSubject.chapters.map((chapter, chIdx) => {
              const chapterTopics = chapter.topics || [];
              const chapterCompleted = chapterTopics.filter((t) =>
                completedTopicIds.includes(t.id)
              ).length;
              const isChapterDone =
                chapterTopics.length > 0 && chapterCompleted === chapterTopics.length;

              return (
                <View
                  key={chapter.id}
                  style={[
                    styles.chapterCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}>
                  {/* Chapter Header */}
                  <View style={styles.chapterHeader}>
                    <View
                      style={[
                        styles.chapterNumberBadge,
                        { backgroundColor: colors.cardSecondary },
                      ]}>
                      <Text style={[styles.chapterNumberText, { color: colors.primary }]}>
                        0{chIdx + 1}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.chapterTitle, { color: colors.text }]}>
                        {chapter.title}
                      </Text>
                      {chapter.description ? (
                        <Text
                          style={[styles.chapterSubDesc, { color: colors.textMuted }]}
                          numberOfLines={1}>
                          {chapter.description}
                        </Text>
                      ) : null}
                    </View>
                    <View
                      style={[
                        styles.chapterBadgePill,
                        {
                          backgroundColor: isChapterDone
                            ? 'rgba(16, 185, 129, 0.15)'
                            : colors.cardSecondary,
                        },
                      ]}>
                      <Text
                        style={[
                          styles.chapterBadgeText,
                          { color: isChapterDone ? '#10B981' : colors.textMuted },
                        ]}>
                        {chapterCompleted}/{chapterTopics.length}
                      </Text>
                    </View>
                  </View>

                  {/* Subtopics List */}
                  <View
                    style={[
                      styles.subtopicsList,
                      { borderTopColor: colors.border },
                    ]}>
                    {chapterTopics.map((topic) => {
                      const done = completedTopicIds.includes(topic.id);
                      return (
                        <Pressable
                          key={topic.id}
                          onPress={() => setSelectedTopicId(topic.id)}
                          style={({ pressed }) => [
                            styles.subtopicRow,
                            { borderBottomColor: colors.border },
                            pressed && { backgroundColor: colors.cardSecondary },
                          ]}>
                          <View style={styles.subtopicCheckboxCol}>
                            <Ionicons
                              name={done ? 'checkmark-circle' : 'ellipse-outline'}
                              size={20}
                              color={done ? '#10B981' : colors.textMuted}
                            />
                          </View>

                          <View style={styles.subtopicTitleCol}>
                            <Text
                              style={[
                                styles.subtopicTitle,
                                {
                                  color: done ? colors.textMuted : colors.text,
                                  textDecorationLine: done ? 'line-through' : 'none',
                                },
                              ]}>
                              {topic.title}
                            </Text>
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

  // ---------------------------------------------------------------------------
  // VIEW 1: ACADEMIC SUBJECTS LIST (MAIN SCREEN)
  // ---------------------------------------------------------------------------
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header: icon with text Subjects Notes & tagline */}
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
            <Ionicons name="book" size={20} color={colors.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Subjects Notes</Text>
            <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
              Academic foundations in discrete math, computation theory, and computer systems
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
            placeholder="Search subjects, topics, proofs..."
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
                <Ionicons name="document-text" size={16} color={colors.warning} />
                <Text style={[styles.matchingTopicsHeading, { color: colors.text }]}>
                  Matching Topics
                </Text>
              </View>
              <View style={[styles.matchingCountBadge, { backgroundColor: colors.cardSecondary }]}>
                <Text style={[styles.matchingCountBadgeText, { color: colors.warning }]}>
                  {matchingTopics.length} found
                </Text>
              </View>
            </View>

            <View style={styles.matchingTopicsList}>
              {matchingTopics.map(({ topic, subject, chapterTitle }) => {
                const isDone = completedTopicIds.includes(topic.id);
                return (
                  <Pressable
                    key={`${subject.id}-${topic.id}`}
                    onPress={() => {
                      setSelectedSubjectId(subject.id);
                      setSelectedTopicId(topic.id);
                    }}
                    style={({ pressed }) => [
                      styles.matchingTopicCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                      pressed && { opacity: 0.85, borderColor: subject.color },
                    ]}>
                    <View style={styles.matchingTopicLeft}>
                      <View
                        style={[
                          styles.matchingTopicIconBox,
                          {
                            backgroundColor: isDone
                              ? 'rgba(16, 185, 129, 0.15)'
                              : `${subject.color}18`,
                          },
                        ]}>
                        <Ionicons
                          name={isDone ? 'checkmark-circle' : 'document-text-outline'}
                          size={17}
                          color={isDone ? '#10B981' : subject.color}
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
                              { backgroundColor: `${subject.color}18` },
                            ]}>
                            <Text
                              style={[
                                styles.matchingTopicBadgeText,
                                { color: subject.color },
                              ]}>
                              {subject.name}
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
            ACADEMIC SUBJECTS ({filteredSubjects.length})
          </Text>
          {isOffline && (
            <View style={[styles.offlinePill, { backgroundColor: colors.cardSecondary }]}>
              <Ionicons name="cloud-offline-outline" size={12} color={colors.textMuted} />
              <Text style={[styles.offlinePillText, { color: colors.textMuted }]}>Cached</Text>
            </View>
          )}
        </View>

        {/* Empty Filter / Search State */}
        {filteredSubjects.length === 0 && matchingTopics.length === 0 ? (
          <View
            style={[
              styles.emptyFilterContainer,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}>
            <View style={[styles.emptyFilterIconWrap, { backgroundColor: colors.cardSecondary }]}>
              <Ionicons name="search-outline" size={28} color={colors.textMuted} />
            </View>
            <Text style={[styles.emptyFilterTitle, { color: colors.text }]}>No matching subjects</Text>
            <Text style={[styles.emptyFilterSub, { color: colors.textSecondary }]}>
              {searchQuery
                ? `We couldn't find any subjects or topics matching "${searchQuery}".`
                : 'No academic subjects match the selected filter.'}
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

        {/* Subjects List Cards */}
        <View style={styles.tracksList}>
          {filteredSubjects.map((subject) => {
            const allTopics = getAllSubjectTopics(subject);
            const completedCount = allTopics.filter((t) =>
              completedTopicIds.includes(t.id)
            ).length;
            const percent =
              allTopics.length > 0 ? Math.round((completedCount / allTopics.length) * 100) : 0;
            const isCompleted = allTopics.length > 0 && completedCount === allTopics.length;
            const isStarted = completedCount > 0 && !isCompleted;

            return (
              <Pressable
                key={subject.id}
                onPress={() => setSelectedSubjectId(subject.id)}
                style={({ pressed }) => [
                  styles.trackCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                  pressed && {
                    borderColor: subject.color,
                    transform: [{ scale: 0.99 }],
                  },
                ]}>
                {/* Subject Header Row */}
                <View style={styles.trackHeaderRow}>
                  <View style={styles.trackLeftHeader}>
                    <View
                      style={[
                        styles.trackIconWrap,
                        { backgroundColor: `${subject.color}1E` },
                      ]}>
                      {isIconUrl(subject.icon) ? (
                        <Image
                          source={{ uri: subject.icon }}
                          style={{ width: 22, height: 22 }}
                          resizeMode="contain"
                        />
                      ) : (
                        <Ionicons
                          name={subject.icon as any}
                          size={22}
                          color={subject.color}
                        />
                      )}
                    </View>
                    <View
                      style={[
                        styles.badgePill,
                        { backgroundColor: `${subject.color}18` },
                      ]}>
                      <Text style={[styles.badgeText, { color: subject.color }]}>
                        {subject.badge}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.statusPill,
                      isCompleted
                        ? {
                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
                            borderColor: '#10B981',
                          }
                        : isStarted
                        ? {
                            backgroundColor: `${subject.color}18`,
                            borderColor: subject.color,
                          }
                        : {
                            backgroundColor: colors.cardSecondary,
                            borderColor: colors.border,
                          },
                    ]}>
                    <Text
                      style={[
                        styles.statusPillText,
                        {
                          color: isCompleted
                            ? '#10B981'
                            : isStarted
                            ? subject.color
                            : colors.textMuted,
                        },
                      ]}>
                      {isCompleted ? 'COMPLETED' : isStarted ? 'IN PROGRESS' : 'START SUBJECT'}
                    </Text>
                  </View>
                </View>

                {/* Subject Title and Description */}
                <Text style={[styles.trackName, { color: colors.text }]}>{subject.name}</Text>
                <Text style={[styles.trackDesc, { color: colors.textSecondary }]}>
                  {subject.description}
                </Text>

                {/* Progress Bar */}
                <View style={[styles.progressBarBg, { backgroundColor: colors.cardSecondary }]}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${percent}%`,
                        backgroundColor: isCompleted ? '#10B981' : subject.color,
                      },
                    ]}
                  />
                </View>

                {/* Card Footer */}
                <View style={styles.trackStatsRow}>
                  <Text style={[styles.trackStatsText, { color: colors.textMuted }]}>
                    {completedCount} of {allTopics.length} topics completed
                  </Text>
                  <Text
                    style={[
                      styles.trackPercentText,
                      { color: isCompleted ? '#10B981' : subject.color },
                    ]}>
                    {percent}%
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// STYLES
// ---------------------------------------------------------------------------
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
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.heading,
    fontSize: 21,
    fontWeight: '700',
  },
  headerSub: {
    fontFamily: Fonts.body,
    fontSize: 13,
    marginTop: 2,
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

  // Section Header
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionHeading: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  offlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  offlinePillText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '600',
  },

  // Subject Tracks List
  tracksList: {
    gap: 14,
  },
  trackCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    marginBottom: 4,
  },
  trackHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  trackLeftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trackIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  estHoursText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '600',
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusPillText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  trackName: {
    fontFamily: Fonts.heading,
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 6,
  },
  trackDesc: {
    fontFamily: Fonts.body,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
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
  trackStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  trackStatsText: {
    fontFamily: Fonts.body,
    fontSize: 12,
  },
  trackPercentText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
  },

  // View 2: Subject Chapters Detail Screen
  languageDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  backBtnText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    fontWeight: '600',
  },
  trackHeroCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
  },
  chaptersList: {
    gap: 14,
  },
  chapterCard: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  chapterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  chapterNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  chapterNumberText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '800',
  },
  chapterTitle: {
    fontFamily: Fonts.heading,
    fontSize: 15,
    fontWeight: '700',
  },
  chapterSubDesc: {
    fontFamily: Fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
  chapterBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  chapterBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
  },
  subtopicsList: {
    borderTopWidth: 1,
  },
  subtopicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  subtopicCheckboxCol: {
    marginRight: 10,
  },
  subtopicTitleCol: {
    flex: 1,
    marginRight: 8,
  },
  subtopicTitle: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  subtopicChevronCol: {
    marginLeft: 4,
  },

  // View 3: In-Depth Topic Study Detail
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerCompleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  headerCompleteText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
  },
  topicBreadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  chapterPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  chapterPillText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  topicDetailTitle: {
    fontFamily: Fonts.heading,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
    lineHeight: 28,
  },
  formulaBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  formulaTag: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  formulaText: {
    fontFamily: Fonts.mono,
    fontSize: 16,
    fontWeight: '800',
  },
  definitionCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontFamily: Fonts.heading,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  defText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  propertiesCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  propItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  bulletSymbol: {
    fontSize: 14,
    marginTop: 1,
  },
  propItemText: {
    fontFamily: Fonts.body,
    fontSize: 13.5,
    lineHeight: 19,
    flex: 1,
  },
  exampleBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
  },
  exampleTag: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  exampleText: {
    fontFamily: Fonts.body,
    fontSize: 13.5,
    lineHeight: 19,
  },

  // Interactive Truth Table Simulator
  simCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  simHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  simHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  simTitle: {
    fontFamily: Fonts.heading,
    fontSize: 16,
    fontWeight: '700',
  },
  simBadge: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    color: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  simSub: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    lineHeight: 17,
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  toggleBtnText: {
    fontFamily: Fonts.mono,
    fontSize: 12.5,
    fontWeight: '700',
  },
  matrixTable: {
    borderRadius: 10,
    padding: 10,
  },
  matrixRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  matrixColLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    color: '#94A3B8',
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  matrixValuesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  matrixCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    marginHorizontal: 3,
  },
  cellTrue: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
  },
  cellFalse: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
  },
  cellText: {
    fontFamily: Fonts.mono,
    fontSize: 13.5,
    fontWeight: '800',
    color: '#F8FAFC',
  },

  topicLoadingContainer: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  topicLoadingText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
  },

  // Pagination navigation footer
  topicNavFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
  },
  topicNavBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  topicNavDir: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  topicNavTitle: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12.5,
    fontWeight: '600',
  },
});

