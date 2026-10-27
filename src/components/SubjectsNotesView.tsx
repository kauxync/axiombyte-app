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
import { useAuth } from '@/context/AuthContext';
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
  const { recordStreakActivity } = useAuth();
  const activeSubjects = useMemo(() => subjects || [], [subjects]);

  // Navigation states:
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

  // Adjust state during render if initial navigation props change (React 19 pattern)
  const [prevInitialSubjectId, setPrevInitialSubjectId] = useState(initialSubjectId);
  if (initialSubjectId !== prevInitialSubjectId) {
    setPrevInitialSubjectId(initialSubjectId);
    if (initialSubjectId) {
      setSelectedSubjectId(initialSubjectId);
    }
  }

  const [prevInitialTopicId, setPrevInitialTopicId] = useState(initialTopicId);
  if (initialTopicId !== prevInitialTopicId) {
    setPrevInitialTopicId(initialTopicId);
    if (initialTopicId) {
      setSelectedTopicId(initialTopicId);
    }
  }

  // Hardware Back button handling
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedTopicId) {
        setSelectedTopicId(null);
        return true;
      }
      if (selectedSubjectId) {
        setSelectedSubjectId(null);
        return true;
      }
      if (canGoBack && onGoBack) {
        onGoBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [selectedTopicId, selectedSubjectId, canGoBack, onGoBack]);

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<
    'all' | 'in_progress' | 'completed' | 'not_started'
  >('all');

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

  // Overall curriculum stats for subjects
  const overallSubjectsStats = useMemo(() => {
    let totalTopics = 0;
    let completedTopics = 0;
    let masteredSubjects = 0;
    activeSubjects.forEach((subj) => {
      const allTopics = getAllSubjectTopics(subj);
      const completedCount = allTopics.filter((t) => completedTopicIds.includes(t.id)).length;
      totalTopics += allTopics.length;
      completedTopics += completedCount;
      if (allTopics.length > 0 && completedCount === allTopics.length) masteredSubjects++;
    });
    const percent = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
    return {
      totalSubjects: activeSubjects.length,
      totalTopics,
      completedTopics,
      masteredSubjects,
      percent,
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
              <View style={[styles.chapterPill, { backgroundColor: `${currentSubject.color}18`, borderColor: `${currentSubject.color}35`, borderWidth: 0.5 }]}>
                <Ionicons name="bookmark-outline" size={11} color={currentSubject.color} style={{ marginRight: 4 }} />
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
                Loading theoretical notes & proofs...
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
                  borderColor: isDark ? 'rgba(245, 158, 11, 0.35)' : colors.border,
                },
              ]}>
              <View style={[styles.cardAccentLine, { backgroundColor: '#F59E0B' }]} />
              <View style={styles.simHeader}>
                <View style={styles.simHeaderLeft}>
                  <View style={[styles.simIconBadge, { backgroundColor: 'rgba(245, 158, 11, 0.16)' }]}>
                    <Ionicons name="flash" size={16} color="#F59E0B" />
                  </View>
                  <Text style={[styles.simTitle, { color: colors.text }]}>
                    Interactive Logic Lab
                  </Text>
                </View>
                <View style={styles.simLiveBadge}>
                  <View style={styles.livePulseDot} />
                  <Text style={styles.simBadgeText}>LIVE ENGINE</Text>
                </View>
              </View>
              <Text style={[styles.simSub, { color: colors.textSecondary }]}>
                Toggle P and Q below to evaluate truth values, conjunctions, disjunctions, and implications in real time:
              </Text>

              {/* Toggle Switches */}
              <View style={styles.toggleRow}>
                <Pressable
                  onPress={() => setValP(!valP)}
                  style={[
                    styles.toggleBtn,
                    {
                      backgroundColor: valP ? colors.primary : colors.cardSecondary,
                      borderColor: valP ? colors.primary : colors.border,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.toggleLabel,
                      { color: valP ? '#0F172A' : colors.text },
                    ]}>
                    Input P : {valP ? 'TRUE (1)' : 'FALSE (0)'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setValQ(!valQ)}
                  style={[
                    styles.toggleBtn,
                    {
                      backgroundColor: valQ ? colors.primary : colors.cardSecondary,
                      borderColor: valQ ? colors.primary : colors.border,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.toggleLabel,
                      { color: valQ ? '#0F172A' : colors.text },
                    ]}>
                    Input Q : {valQ ? 'TRUE (1)' : 'FALSE (0)'}
                  </Text>
                </Pressable>
              </View>

              {/* Truth Table Grid */}
              <View
                style={[
                  styles.tableGrid,
                  {
                    backgroundColor: colors.cardSecondary,
                    borderColor: colors.borderSubtle,
                  },
                ]}>
                <View style={[styles.tableRow, styles.tableHeaderRow, { borderBottomColor: colors.borderSubtle }]}>
                  <Text style={[styles.thCell, { color: colors.textMuted }]}>OPERATION</Text>
                  <Text style={[styles.thCell, { color: colors.textMuted }]}>FORMULA</Text>
                  <Text style={[styles.thCell, { textAlign: 'right', color: colors.textMuted }]}>
                    RESULT
                  </Text>
                </View>

                {[
                  { name: 'Negation ¬P', formula: 'not P', val: notP },
                  { name: 'Conjunction P ∧ Q', formula: 'P and Q', val: pAndQ },
                  { name: 'Disjunction P ∨ Q', formula: 'P or Q', val: pOrQ },
                  { name: 'Implication P → Q', formula: '¬P ∨ Q', val: pImpliesQ },
                  { name: 'Equivalence P ↔ Q', formula: 'P == Q', val: pBicondQ },
                ].map((row, rIdx) => (
                  <View
                    key={rIdx}
                    style={[
                      styles.tableRow,
                      { borderBottomColor: colors.borderSubtle },
                      rIdx % 2 === 1 && { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)' },
                    ]}>
                    <Text style={[styles.tdCellName, { color: colors.text }]}>{row.name}</Text>
                    <Text style={[styles.tdCellFormula, { color: colors.textSecondary }]}>
                      {row.formula}
                    </Text>
                    <View
                      style={[
                        styles.boolBadge,
                        {
                          backgroundColor: row.val
                            ? 'rgba(16, 185, 129, 0.16)'
                            : 'rgba(239, 68, 68, 0.16)',
                        },
                      ]}>
                      <Text
                        style={[
                          styles.boolText,
                          { color: row.val ? '#10B981' : '#EF4444' },
                        ]}>
                        {row.val ? 'TRUE' : 'FALSE'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Bottom Next/Prev Topic Navigation Buttons */}
          <View style={styles.topicBottomNav}>
            {prevTopic ? (
              <Pressable
                onPress={() => setSelectedTopicId(prevTopic.id)}
                style={({ pressed }) => [
                  styles.topicNavBtn,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  pressed && { opacity: 0.75, transform: [{ scale: 0.99 }] },
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
                  pressed && { opacity: 0.75, transform: [{ scale: 0.99 }] },
                ]}>
                <View style={{ flex: 1, marginRight: 8, alignItems: 'flex-end' }}>
                  <Text style={[styles.topicNavDir, { color: colors.textMuted }]}>NEXT NOTE</Text>
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
        {/* Top Header Bar */}
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
            onPress={() => setSelectedSubjectId(null)}
            style={({ pressed }) => [
              styles.backBtnPill,
              { backgroundColor: colors.cardSecondary, borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
            hitSlop={8}>
            <Ionicons name="arrow-back" size={16} color={colors.text} />
            <Text style={[styles.backBtnText, { color: colors.text }]}>Academic Notes</Text>
          </Pressable>

          <View style={[styles.headerCodePill, { backgroundColor: `${currentSubject.color}16`, borderColor: `${currentSubject.color}35` }]}>
            <Text style={[styles.headerCodePillText, { color: currentSubject.color }]}>
              {currentSubject.badge}
            </Text>
          </View>
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
            <View style={[styles.cardAccentLine, { backgroundColor: currentSubject.color }]} />

            <View style={styles.trackHeroBody}>
              <View style={styles.trackHeaderRow}>
                <View style={styles.trackLeftHeader}>
                  <View
                    style={[
                      styles.trackIconWrap,
                      { backgroundColor: `${currentSubject.color}1E`, borderColor: `${currentSubject.color}35` },
                    ]}>
                    {isIconUrl(currentSubject.icon) ? (
                      <Image
                        source={{ uri: currentSubject.icon }}
                        style={{ width: 24, height: 24 }}
                        resizeMode="contain"
                      />
                    ) : (
                      <Ionicons
                        name={currentSubject.icon as any}
                        size={24}
                        color={currentSubject.color}
                      />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.trackName, { color: colors.text }]}>{currentSubject.name}</Text>
                    <View style={styles.heroSubMetaRow}>
                      <View
                        style={[
                          styles.badgePill,
                          { backgroundColor: `${currentSubject.color}18`, borderColor: `${currentSubject.color}30`, borderWidth: 0.5 },
                        ]}>
                        <Text style={[styles.badgeText, { color: currentSubject.color }]}>
                          {currentSubject.badge}
                        </Text>
                      </View>
                      {currentSubject.estHours && (
                        <Text style={[styles.estHoursText, { color: colors.textMuted }]}>
                          • {currentSubject.estHours}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              </View>

              <Text style={[styles.trackDesc, { color: colors.textSecondary }]}>
                {currentSubject.description}
              </Text>

              {/* Progress Bar & Stats */}
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
          </View>

          {/* Section Heading: Chapters */}
          <Text style={[styles.sectionHeading, { color: colors.textMuted, marginTop: 18, marginBottom: 12 }]}>
            MODULES & SYLLABUS ({currentSubject.chapters.length})
          </Text>

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
                <AnimatedCard
                  key={chapter.id}
                  index={chIdx}
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
                      <Text style={[styles.chapterNumberText, { color: currentSubject.color }]}>
                        {String(chIdx + 1).padStart(2, '0')}
                      </Text>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.chapterTitle, { color: colors.text }]}>
                        {chapter.title}
                      </Text>
                      <Text style={[styles.chapterMeta, { color: colors.textMuted }]}>
                        {chapterTopics.length} {chapterTopics.length === 1 ? 'topic' : 'topics'} • Module {chIdx + 1}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.chapterStatusBadge,
                        {
                          backgroundColor: isChapterDone
                            ? 'rgba(16, 185, 129, 0.14)'
                            : colors.cardSecondary,
                        },
                      ]}>
                      <Text
                        style={[
                          styles.chapterStatusText,
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
                    {chapterTopics.map((topic, tIdx) => {
                      const isTopicDone = completedTopicIds.includes(topic.id);

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

                          <View style={styles.subtopicInfo}>
                            <Text
                              style={[
                                styles.subtopicTitle,
                                {
                                  color: isTopicDone
                                    ? colors.textSecondary
                                    : colors.text,
                                },
                              ]}
                              numberOfLines={1}>
                              {topic.title}
                            </Text>
                            <Text style={[styles.subtopicMetaText, { color: colors.textMuted }]}>
                              {chIdx + 1}.{tIdx + 1} • {topic.duration || '15 min read'}
                            </Text>
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

  // ---------------------------------------------------------------------------
  // VIEW 1: ACADEMIC SUBJECTS LIST (MAIN SCREEN)
  // ---------------------------------------------------------------------------
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
            <Text style={[styles.headerTitle, { color: colors.text }]}>Academic Notes</Text>
            <Text style={[styles.headerSub, { color: colors.textSecondary }]} numberOfLines={1}>
              Theoretical foundations, proofs & system engineering
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
        {/* Scholar Mastery Deck Card */}
        <View
          style={[
            styles.overviewStatsCard,
            {
              backgroundColor: colors.card,
              borderColor: isDark ? 'rgba(245, 158, 11, 0.35)' : colors.border,
            },
          ]}>
          <View style={[styles.cardAccentLine, { backgroundColor: '#F59E0B' }]} />

          <View style={styles.overviewCardInner}>
            <View style={styles.overviewTopRow}>
              <View style={styles.overviewTagBadge}>
                <Ionicons name="school" size={13} color="#F59E0B" />
                <Text style={styles.overviewTagText}>CS THEORY & ARCHITECTURE</Text>
              </View>

              <View style={[styles.masteryPill, { backgroundColor: 'rgba(245, 158, 11, 0.14)' }]}>
                <Text style={[styles.masteryPillText, { color: '#F59E0B' }]}>
                  {overallSubjectsStats.percent}% MASTERED
                </Text>
              </View>
            </View>

            {/* Micro Progress Track */}
            <View style={[styles.overviewTrackBg, { backgroundColor: colors.cardSecondary }]}>
              <View
                style={[
                  styles.overviewTrackFill,
                  { width: `${overallSubjectsStats.percent}%`, backgroundColor: '#F59E0B' },
                ]}
              />
            </View>

            {/* 3 Metrics Capsule Row */}
            <View style={[styles.metricsCapsuleRow, { backgroundColor: colors.cardSecondary, borderColor: colors.borderSubtle }]}>
              <View style={styles.metricColumn}>
                <Text style={[styles.metricBigNumber, { color: colors.text }]}>
                  {overallSubjectsStats.totalSubjects}
                </Text>
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Subjects</Text>
              </View>

              <View style={[styles.metricDivider, { backgroundColor: colors.borderSubtle }]} />

              <View style={styles.metricColumn}>
                <Text style={[styles.metricBigNumber, { color: '#10B981' }]}>
                  {overallSubjectsStats.completedTopics}/{overallSubjectsStats.totalTopics}
                </Text>
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Notes Done</Text>
              </View>

              <View style={[styles.metricDivider, { backgroundColor: colors.borderSubtle }]} />

              <View style={styles.metricColumn}>
                <Text style={[styles.metricBigNumber, { color: colors.primary }]}>
                  {overallSubjectsStats.masteredSubjects}
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
            placeholder="Search subjects, proofs, theorems, notes..."
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
                <Ionicons name="document-text" size={16} color="#F59E0B" />
                <Text style={[styles.matchingTopicsHeading, { color: colors.text }]}>
                  Matching Notes
                </Text>
              </View>
              <View style={[styles.matchingCountBadge, { backgroundColor: colors.cardSecondary }]}>
                <Text style={[styles.matchingCountBadgeText, { color: colors.primary }]}>
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
                      pressed && { opacity: 0.85, borderColor: subject.color, transform: [{ scale: 0.99 }] },
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
            CORE SUBJECTS ({filteredSubjects.length})
          </Text>
        </View>

        {/* Empty Filter / Search State */}
        {filteredSubjects.length === 0 && matchingTopics.length === 0 ? (
          <View
            style={[
              styles.emptyFilterContainer,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}>
            <View style={[styles.emptyFilterIconWrap, { backgroundColor: colors.cardSecondary }]}>
              <Ionicons name="search-outline" size={26} color={colors.textMuted} />
            </View>
            <Text style={[styles.emptyFilterTitle, { color: colors.text }]}>No matching subjects</Text>
            <Text style={[styles.emptyFilterSub, { color: colors.textSecondary }]}>
              {searchQuery
                ? `We couldn't find any subjects or notes matching "${searchQuery}".`
                : 'No academic subjects match the selected filter category.'}
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

        {/* Subjects List Cards */}
        <View style={styles.tracksList}>
          {filteredSubjects.map((subject, idx) => {
            const allTopics = getAllSubjectTopics(subject);
            const completedCount = allTopics.filter((t) =>
              completedTopicIds.includes(t.id)
            ).length;
            const percent =
              allTopics.length > 0 ? Math.round((completedCount / allTopics.length) * 100) : 0;
            const isCompleted = allTopics.length > 0 && completedCount === allTopics.length;
            const isStarted = completedCount > 0 && !isCompleted;

            return (
              <AnimatedCard
                key={subject.id}
                index={idx}
                onPress={() => setSelectedSubjectId(subject.id)}
                style={[
                  styles.trackCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: isCompleted
                      ? 'rgba(16, 185, 129, 0.45)'
                      : colors.border,
                  },
                ]}>
                {/* Brand Color Top Accent Line */}
                <View style={[styles.cardAccentLine, { backgroundColor: subject.color }]} />

                <View style={styles.cardInnerPadding}>
                  {/* Subject Header Row */}
                  <View style={styles.trackHeaderRow}>
                    <View style={styles.trackLeftHeader}>
                      <View
                        style={[
                          styles.trackIconWrap,
                          {
                            backgroundColor: `${subject.color}1E`,
                            borderColor: `${subject.color}35`,
                          },
                        ]}>
                        {isIconUrl(subject.icon) ? (
                          <Image
                            source={{ uri: subject.icon }}
                            style={{ width: 24, height: 24 }}
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
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text style={[styles.trackName, { color: colors.text }]}>{subject.name}</Text>
                          <View
                            style={[
                              styles.badgePill,
                              { backgroundColor: `${subject.color}16`, borderColor: `${subject.color}30`, borderWidth: 0.5 },
                            ]}>
                            <Text style={[styles.badgeText, { color: subject.color }]}>
                              {subject.badge}
                            </Text>
                          </View>
                        </View>
                        {subject.estHours ? (
                          <View style={styles.estHoursRow}>
                            <Ionicons name="time-outline" size={11} color={colors.textMuted} />
                            <Text style={[styles.estHoursText, { color: colors.textMuted }]}>
                              {subject.estHours}
                            </Text>
                          </View>
                        ) : null}
                      </View>
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
                              backgroundColor: `${subject.color}16`,
                              borderColor: `${subject.color}40`,
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
                              ? subject.color
                              : colors.textMuted,
                          },
                        ]}>
                        {isCompleted ? 'COMPLETED' : isStarted ? 'IN PROGRESS' : 'NOT STARTED'}
                      </Text>
                    </View>
                  </View>

                  {/* Subject Description */}
                  <Text style={[styles.trackDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                    {subject.description}
                  </Text>

                  {/* Progress Bar & Footer */}
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

                  <View style={styles.cardFooterRow}>
                    <Text style={[styles.trackStatsText, { color: colors.textMuted }]}>
                      {completedCount} of {allTopics.length} topics completed
                    </Text>

                    <View style={styles.ctaPillWrap}>
                      <Text
                        style={[
                          styles.ctaPillText,
                          { color: isCompleted ? '#10B981' : subject.color },
                        ]}>
                        {isCompleted
                          ? 'Review Notes ➔'
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
    color: '#F59E0B',
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

  // Subject Tracks List
  tracksList: {
    gap: 14,
  },
  trackCard: {
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
  trackHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  trackLeftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  trackIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackName: {
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
  badgeText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  estHoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  estHoursText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '600',
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
  trackDesc: {
    fontFamily: Fonts.body,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
    marginBottom: 12,
  },
  sampleChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
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
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  trackStatsText: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    fontVariant: ['tabular-nums'],
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
  trackHeroCard: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 6,
  },
  trackHeroBody: {
    padding: 18,
  },
  heroSubMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  trackStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
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
  chapterMeta: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
  },
  chapterStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
  },
  chapterStatusText: {
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
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  subtopicCheckBtn: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subtopicInfo: {
    flex: 1,
  },
  subtopicTitle: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13.5,
  },
  subtopicMetaText: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    marginTop: 2,
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
  simCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 20,
    marginBottom: 20,
    padding: 18,
  },
  simHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  simHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  simIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  simTitle: {
    fontFamily: Fonts.heading,
    fontSize: 16,
    fontWeight: '700',
  },
  simLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
  },
  simBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '800',
    color: '#F59E0B',
  },
  simSub: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    lineHeight: 17,
    marginBottom: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  toggleLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
  },
  tableGrid: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  tableHeaderRow: {
    paddingVertical: 7,
  },
  thCell: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '700',
    flex: 1,
  },
  tdCellName: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12.5,
    flex: 1.2,
  },
  tdCellFormula: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    flex: 1,
  },
  boolBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    minWidth: 46,
    alignItems: 'center',
  },
  boolText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '800',
  },
  topicBottomNav: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  topicNavBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  topicNavDir: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  topicNavTitle: {
    fontFamily: Fonts.headingMedium,
    fontSize: 13,
    marginTop: 2,
  },
});
