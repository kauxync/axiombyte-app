import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Share,
  Dimensions,
  BackHandler,
  RefreshControl,
  Platform,
  ToastAndroid,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '@/context/AuthContext';
import { useAlert } from '@/context/AlertContext';
import { StyledAlertButton } from './StyledAlertModal';
import { AvatarIcon } from './AvatarPicker';
import { ReferralModal } from './ReferralModal';
import { StreakModal } from './StreakModal';
import { Fonts } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/context/ThemeContext';
import { AppTab } from './BottomNavBar';
import { useCurriculum } from '@/context/CurriculumContext';
import { getAllTopics } from '@/data/roadmaps';
import { getAllSubjectTopics } from '@/data/subjects';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 330);
const LANG_CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 330);
const LANG_CARD_GAP = 14;

function isIconUrl(icon?: string): boolean {
  if (!icon) return false;
  return (
    icon.startsWith('http://') ||
    icon.startsWith('https://') ||
    icon.startsWith('data:') ||
    icon.startsWith('file://') ||
    icon.includes('/')
  );
}

export function HomeDashboardView({
  onNavigateTab,
}: {
  onNavigateTab?: (
    tab: AppTab,
    params?: { languageId?: string; subjectId?: string; topicId?: string }
  ) => void;
}) {
  const { user, streak } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const {
    languages,
    subjects,
    activeCourses,
    refreshProgress,
    refreshCurriculum,
    isOffline,
    removeActiveCourse,
  } = useCurriculum();
  const { showAlert } = useAlert();

  const Alert = {
    alert: (
      title: string,
      message?: string,
      buttons?: StyledAlertButton[]
    ) => {
      showAlert(title, message, buttons);
    },
  };

  // Refresh dynamic user progress on mount / return to home
  useEffect(() => {
    refreshProgress();
  }, [refreshProgress]);

  const [showReferralModal, setShowReferralModal] = useState(false);
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const showSyncFeedback = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    }
  };

  const handleUpdateCache = async (force?: boolean) => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await refreshCurriculum({ force });
      if (result.isOffline) {
        showSyncFeedback('Offline mode: Web API unreachable. Using cached curriculum');
      } else {
        showSyncFeedback(
          `Cache updated from Web API: ${result.languagesCount} tracks & ${result.subjectsCount} subjects`
        );
      }
    } catch {
      showSyncFeedback('Offline mode: Loaded local cache');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenCacheOptions = () => {
    Alert.alert(
      'Curriculum Cache Options',
      `Manage local curriculum and offline lesson content.\n\nCurrent status: ${
        isOffline ? 'Offline Cache' : 'Synchronized with Cloud'
      }`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Update Cache',
          onPress: () => handleUpdateCache(false),
        },
        {
          text: 'Force Refresh & Purge',
          style: 'destructive',
          onPress: () => handleUpdateCache(true),
        },
      ]
    );
  };

  const handleRemoveActiveItem = (item: any) => {
    const trackId = item.languageId || item.subjectId || item.id.replace(/^active_(lang|subj)_/, '');
    const courseTitle = item.title || 'this course';
    Alert.alert(
      'Remove from Continue Studying?',
      `Are you sure you want to remove "${courseTitle}" from your active study list?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeActiveCourse(trackId, item.category);
            showSyncFeedback(`Removed "${courseTitle}" from Continue Studying`);
          },
        },
      ]
    );
  };

  // Available Languages dynamically delivered via API & Local Storage Cache
  const availableLanguages = useMemo(() => {
    return languages.map((r) => {
      const allTopics = getAllTopics(r);
      // Chapter names for the card chips
      const chapterNames: string[] = [];
      if (Array.isArray(r.chapters) && r.chapters.length > 0) {
        for (const ch of r.chapters) {
          if (ch.title && !chapterNames.includes(ch.title)) {
            chapterNames.push(ch.title);
            if (chapterNames.length >= 3) break;
          }
        }
      } else {
        for (const t of allTopics) {
          if (t.title && !chapterNames.includes(t.title)) {
            chapterNames.push(t.title);
            if (chapterNames.length >= 3) break;
          }
        }
      }

      // Live progress for this track
      const activeMatch = activeCourses.find(
        (ac) => ac.languageId === r.id || ac.id === `active_lang_${r.id}` || ac.id === r.id
      );

      return {
        id: r.id,
        name: r.name,
        badge: r.badge,
        description: r.description,
        iconName: r.icon,
        iconColor: r.color,
        iconBg: `${r.color}20`,
        modulesCount: allTopics.length,
        chaptersCount: r.chapters ? r.chapters.length : 1,
        chapterNames,
        sampleTopics: chapterNames,
        progressPercent: activeMatch ? activeMatch.progressPercent : 0,
        currentStep: activeMatch ? activeMatch.currentStep : undefined,
        targetTab: r.targetTab || 'roadmaps',
      };
    });
  }, [languages, activeCourses]);

  // Available Subjects dynamically delivered via API & Local Storage Cache
  const availableSubjects = useMemo(() => {
    return (subjects || []).map((s) => {
      const allTopics = s.topics ? s.topics : getAllSubjectTopics(s);
      // Chapter names for the card chips
      const chapterNames: string[] = [];
      if (Array.isArray(s.chapters) && s.chapters.length > 0) {
        for (const ch of s.chapters) {
          if (ch.title && !chapterNames.includes(ch.title)) {
            chapterNames.push(ch.title);
            if (chapterNames.length >= 3) break;
          }
        }
      } else {
        for (const t of allTopics) {
          if (t.title && !chapterNames.includes(t.title)) {
            chapterNames.push(t.title);
            if (chapterNames.length >= 3) break;
          }
        }
      }

      const activeMatch = activeCourses.find(
        (ac) => ac.subjectId === s.id || ac.id === `active_subj_${s.id}` || ac.id === s.id
      );

      return {
        id: s.id,
        name: s.name,
        badge: s.badge,
        description: s.description,
        iconName: s.icon,
        iconColor: s.color,
        iconBg: `${s.color}20`,
        topicsCount: allTopics.length,
        chaptersCount: s.chapters ? s.chapters.length : 1,
        estHours: s.estHours || '12 hrs',
        chapterNames,
        sampleTopics: chapterNames,
        progressPercent: activeMatch ? activeMatch.progressPercent : 0,
        currentStep: activeMatch ? activeMatch.currentStep : undefined,
        targetTab: s.targetTab || 'math',
      };
    });
  }, [subjects, activeCourses]);

  type HomeFilter = 'all' | 'languages' | 'subjects' | 'active';
  const [selectedFilter, setSelectedFilter] = useState<HomeFilter>('all');

  // Filtered lists based on search query and topics
  const filteredLanguages = useMemo(() => {
    if (!searchQuery.trim()) return availableLanguages;
    const q = searchQuery.toLowerCase().trim();
    return availableLanguages.filter((lang) => {
      if (
        lang.name.toLowerCase().includes(q) ||
        lang.badge.toLowerCase().includes(q) ||
        lang.description.toLowerCase().includes(q)
      ) {
        return true;
      }
      const roadmap = languages.find((r) => r.id === lang.id);
      if (roadmap) {
        const topics = getAllTopics(roadmap);
        return topics.some(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            (t.tag && t.tag.toLowerCase().includes(q)) ||
            (t.summary && t.summary.toLowerCase().includes(q))
        );
      }
      return false;
    });
  }, [searchQuery, availableLanguages, languages]);

  // Hand gesture swipe & pagination state for Language cards
  const langScrollRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const [activeLangIndex, setActiveLangIndex] = useState(0);

  // Safe active index bounded by current filtered results
  const currentActiveLangIndex =
    activeLangIndex >= filteredLanguages.length
      ? Math.max(0, filteredLanguages.length - 1)
      : activeLangIndex;

  const handleNextLang = () => {
    if (currentActiveLangIndex < filteredLanguages.length - 1) {
      const nextIdx = currentActiveLangIndex + 1;
      setActiveLangIndex(nextIdx);
      langScrollRef.current?.scrollTo({
        x: nextIdx * (LANG_CARD_WIDTH + LANG_CARD_GAP),
        animated: true,
      });
    }
  };

  const handlePrevLang = () => {
    if (currentActiveLangIndex > 0) {
      const prevIdx = currentActiveLangIndex - 1;
      setActiveLangIndex(prevIdx);
      langScrollRef.current?.scrollTo({
        x: prevIdx * (LANG_CARD_WIDTH + LANG_CARD_GAP),
        animated: true,
      });
    }
  };

  const handleSelectLangIndex = (index: number) => {
    setActiveLangIndex(index);
    langScrollRef.current?.scrollTo({
      x: index * (LANG_CARD_WIDTH + LANG_CARD_GAP),
      animated: true,
    });
  };

  const filteredSubjects = useMemo(() => {
    if (!searchQuery.trim()) return availableSubjects;
    const q = searchQuery.toLowerCase().trim();
    return availableSubjects.filter((subj) => {
      if (
        subj.name.toLowerCase().includes(q) ||
        subj.badge.toLowerCase().includes(q) ||
        subj.description.toLowerCase().includes(q)
      ) {
        return true;
      }
      const rawSubj = (subjects || []).find((s) => s.id === subj.id);
      if (rawSubj) {
        const topics = getAllSubjectTopics(rawSubj);
        return topics.some(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            (t.category && t.category.toLowerCase().includes(q)) ||
            (t.definition && t.definition.toLowerCase().includes(q))
        );
      }
      return false;
    });
  }, [searchQuery, availableSubjects, subjects]);

  // Hand gesture swipe & pagination state for Subject cards
  const subjScrollRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const [activeSubjIndex, setActiveSubjIndex] = useState(0);

  // Safe active index bounded by current filtered results
  const currentActiveSubjIndex =
    activeSubjIndex >= filteredSubjects.length
      ? Math.max(0, filteredSubjects.length - 1)
      : activeSubjIndex;

  const handleNextSubj = () => {
    if (currentActiveSubjIndex < filteredSubjects.length - 1) {
      const nextIdx = currentActiveSubjIndex + 1;
      setActiveSubjIndex(nextIdx);
      subjScrollRef.current?.scrollTo({
        x: nextIdx * (LANG_CARD_WIDTH + LANG_CARD_GAP),
        animated: true,
      });
    }
  };

  const handlePrevSubj = () => {
    if (currentActiveSubjIndex > 0) {
      const prevIdx = currentActiveSubjIndex - 1;
      setActiveSubjIndex(prevIdx);
      subjScrollRef.current?.scrollTo({
        x: prevIdx * (LANG_CARD_WIDTH + LANG_CARD_GAP),
        animated: true,
      });
    }
  };

  const handleSelectSubjIndex = (index: number) => {
    setActiveSubjIndex(index);
    subjScrollRef.current?.scrollTo({
      x: index * (LANG_CARD_WIDTH + LANG_CARD_GAP),
      animated: true,
    });
  };

  const filteredActiveItems = useMemo(() => {
    if (!searchQuery.trim()) return activeCourses;
    const q = searchQuery.toLowerCase().trim();
    return activeCourses.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.badge.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q)
    );
  }, [searchQuery, activeCourses]);

  // Hand gesture swipe & pagination state for Active Study cards
  const activeStudyScrollRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const [activeStudyIndex, setActiveStudyIndex] = useState(0);

  const currentActiveStudyIndex =
    activeStudyIndex >= filteredActiveItems.length
      ? Math.max(0, filteredActiveItems.length - 1)
      : activeStudyIndex;

  const handleNextActive = () => {
    if (currentActiveStudyIndex < filteredActiveItems.length - 1) {
      const nextIdx = currentActiveStudyIndex + 1;
      setActiveStudyIndex(nextIdx);
      activeStudyScrollRef.current?.scrollTo({
        x: nextIdx * (CAROUSEL_CARD_WIDTH + 14),
        animated: true,
      });
    }
  };

  const handlePrevActive = () => {
    if (currentActiveStudyIndex > 0) {
      const prevIdx = currentActiveStudyIndex - 1;
      setActiveStudyIndex(prevIdx);
      activeStudyScrollRef.current?.scrollTo({
        x: prevIdx * (CAROUSEL_CARD_WIDTH + 14),
        animated: true,
      });
    }
  };

  const handleResumeActiveItem = (item: (typeof activeCourses)[number]) => {
    if (onNavigateTab) {
      if (item.category === 'language' && item.languageId) {
        onNavigateTab('roadmaps', {
          languageId: item.languageId,
          topicId: item.topicId,
        });
      } else if (item.category === 'subject' && item.subjectId) {
        onNavigateTab('math', {
          subjectId: item.subjectId,
          topicId: item.topicId,
        });
      } else {
        onNavigateTab(item.targetTab);
      }
    }
  };

  interface HomeMatchingTopic {
    id: string;
    title: string;
    parentType: 'language' | 'subject';
    parentId: string;
    parentName: string;
    parentBadge: string;
    parentColor: string;
    chapterTitle: string;
    targetTab: AppTab;
  }

  // Deep search matching topics across curriculum
  const matchingTopics = useMemo<HomeMatchingTopic[]>(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    const results: HomeMatchingTopic[] = [];

    // Match language topics
    if (selectedFilter === 'all' || selectedFilter === 'languages') {
      languages.forEach((rm) => {
        (rm.chapters || []).forEach((ch) => {
          (ch.topics || []).forEach((t) => {
            if (
              t.title.toLowerCase().includes(q) ||
              (t.tag && t.tag.toLowerCase().includes(q)) ||
              (t.summary && t.summary.toLowerCase().includes(q))
            ) {
              results.push({
                id: t.id,
                title: t.title,
                parentType: 'language',
                parentId: rm.id,
                parentName: rm.name,
                parentBadge: rm.badge,
                parentColor: rm.color,
                chapterTitle: ch.title,
                targetTab: 'roadmaps',
              });
            }
          });
        });
      });
    }

    // Match subject topics
    if (selectedFilter === 'all' || selectedFilter === 'subjects') {
      (subjects || []).forEach((subj) => {
        (subj.chapters || []).forEach((ch) => {
          (ch.topics || []).forEach((t) => {
            if (
              t.title.toLowerCase().includes(q) ||
              (t.category && t.category.toLowerCase().includes(q)) ||
              (t.definition && t.definition.toLowerCase().includes(q))
            ) {
              results.push({
                id: t.id,
                title: t.title,
                parentType: 'subject',
                parentId: subj.id,
                parentName: subj.name,
                parentBadge: subj.badge,
                parentColor: subj.color,
                chapterTitle: ch.title,
                targetTab: 'math',
              });
            }
          });
        });
      });
    }

    return results;
  }, [searchQuery, selectedFilter, languages, subjects]);

  const hasNoResults = useMemo(() => {
    if (matchingTopics.length > 0) return false;
    if (selectedFilter === 'all') {
      return (
        filteredActiveItems.length === 0 &&
        filteredLanguages.length === 0 &&
        filteredSubjects.length === 0
      );
    }
    if (selectedFilter === 'languages') {
      return filteredLanguages.length === 0;
    }
    if (selectedFilter === 'subjects') {
      return filteredSubjects.length === 0;
    }
    if (selectedFilter === 'active') {
      return filteredActiveItems.length === 0;
    }
    return false;
  }, [selectedFilter, matchingTopics, filteredActiveItems, filteredLanguages, filteredSubjects]);

  // Back button clears active search & resets filter before popping screen
  useEffect(() => {
    if (!searchQuery && selectedFilter === 'all') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
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
  }, [searchQuery, selectedFilter]);

  if (!user) return null;

  const firstName = user.name ? user.name.trim().split(/\s+/)[0] : user.username || 'Scholar';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Handle Share / Copy Referral
  const handleShareReferral = async () => {
    try {
      await Share.share({
        title: 'Master CS & Math on Learn Kauxync',
        message: `Join me on Learn Kauxync to master Computer Science, Systems Programming & Discrete Math! Use my code ${user.referralCode} to get 100 bonus coins on sign-up: https://axiombyte.kauxync.in/`,
      });
    } catch {
      // User dismissed share
    }
  };

  const handleCopyCode = async () => {
    setCopiedReferral(true);
    try {
      if (user.referralCode) {
        await Clipboard.setStringAsync(user.referralCode);
      }
    } catch {
      // Fallback
    }
    Alert.alert('Referral Code Copied!', `Your code "${user.referralCode}" is copied to clipboard and ready to share.`);
    setTimeout(() => setCopiedReferral(false), 3000);
  };

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
      {/* 1. TOP BAR: (avatar, contextual greeting, student level, coins wallet, streak flame) */}
      <View
        style={[
          styles.topHeader,
          {
            paddingTop: Math.max(insets.top, 14),
            backgroundColor: colors.background,
          },
        ]}>
        <View style={styles.topHeaderLeft}>
          <Pressable
            onPress={() => onNavigateTab && onNavigateTab('profile')}
            onLongPress={handleOpenCacheOptions}
            style={({ pressed }) => [
              styles.avatarWrapper,
              { borderColor: colors.border },
              pressed && { opacity: 0.8 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="View profile (long press for cache options)">
            <AvatarIcon avatarId={user.avatar} size={40} />
            {isOffline && (
              <View style={[styles.avatarOfflineBadge, { backgroundColor: colors.warning }]}>
                <Ionicons name="cloud-offline" size={9} color="#0F172A" />
              </View>
            )}
          </Pressable>

          <View style={styles.greetingContainer}>
            <Text style={[styles.topGreetingEyebrow, { color: colors.textMuted }]}>
              {getGreeting()},
            </Text>
            <Text style={[styles.topGreetingName, { color: colors.text }]} numberOfLines={1}>
              {firstName}
            </Text>
          </View>
        </View>

        <View style={styles.topHeaderRight}>
          {/* Global Leaderboard Trophy Pill */}
          <Pressable
            onPress={() => onNavigateTab && onNavigateTab('leaderboard')}
            hitSlop={6}
            style={({ pressed }) => [
              styles.headerTrophyPill,
              {
                backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)',
                borderColor: isDark ? 'rgba(245, 158, 11, 0.28)' : 'rgba(245, 158, 11, 0.22)',
              },
              pressed && { opacity: 0.75, transform: [{ scale: 0.95 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Leaderboard. Tap to view global academic rankings.">
            <Ionicons name="trophy" size={14} color="#F59E0B" />
          </Pressable>

          {/* Coins Wallet Pill */}
          <Pressable
            onPress={() => setShowReferralModal(true)}
            hitSlop={6}
            style={({ pressed }) => [
              styles.headerCoinPill,
              {
                backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)',
                borderColor: isDark ? 'rgba(245, 158, 11, 0.28)' : 'rgba(245, 158, 11, 0.22)',
              },
              pressed && { opacity: 0.75, transform: [{ scale: 0.96 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Wallet: ${user.coins ?? 0} coins. Tap to open rewards.`}>
            <Ionicons name="sparkles" size={12} color="#F59E0B" />
            <Text style={styles.headerCoinText}>{user.coins ?? 0}</Text>
          </Pressable>

          {/* Streak Flame Pill */}
          <Pressable
            onPress={() => setShowStreakModal(true)}
            hitSlop={6}
            style={({ pressed }) => [
              styles.topStreakPill,
              {
                backgroundColor:
                  streak.lostStreak && streak.lostStreak > 0
                    ? 'rgba(239, 68, 68, 0.14)'
                    : streak.todayCompleted
                    ? isDark
                      ? 'rgba(255, 90, 60, 0.16)'
                      : 'rgba(255, 90, 60, 0.10)'
                    : 'rgba(245, 158, 11, 0.10)',
                borderColor:
                  streak.lostStreak && streak.lostStreak > 0
                    ? '#EF4444'
                    : streak.todayCompleted
                    ? '#FF5A3C'
                    : 'rgba(245, 158, 11, 0.3)',
              },
              pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Streak: ${streak.currentStreak} days. Tap to open calendar.`}>
            <Text style={styles.topStreakEmoji}>
              {streak.lostStreak && streak.lostStreak > 0 ? '💔' : '🔥'}
            </Text>
            <Text
              style={[
                styles.topStreakText,
                {
                  color:
                    streak.lostStreak && streak.lostStreak > 0
                      ? '#EF4444'
                      : streak.todayCompleted
                      ? '#FF5A3C'
                      : '#F59E0B',
                },
              ]}>
              {streak.lostStreak && streak.lostStreak > 0
                ? `${streak.lostStreak}d!`
                : `${streak.currentStreak}d`}
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 84 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isSyncing}
            onRefresh={() => handleUpdateCache(false)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }>
        {/* 2. SEARCH BAR */}
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
            placeholder="Search languages, subjects, topics..."
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
              { id: 'all', label: 'All', count: availableLanguages.length + availableSubjects.length },
              { id: 'languages', label: 'Programming', count: filteredLanguages.length },
              { id: 'subjects', label: 'Subjects', count: filteredSubjects.length },
              { id: 'active', label: 'In Progress', count: filteredActiveItems.length },
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

        {/* 2.5. DAILY MOMENTUM / STUDY TARGET CARD (Hidden once target is completed) */}
        {!searchQuery.trim() && !streak.todayCompleted && (
          <Pressable
            onPress={() => setShowStreakModal(true)}
            style={({ pressed }) => [
              styles.dailyMomentumCard,
              {
                backgroundColor: colors.card,
                borderColor: streak.todayCompleted
                  ? isDark ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.45)'
                  : isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(14, 165, 233, 0.3)',
                shadowColor: streak.todayCompleted ? '#10B981' : colors.primary,
              },
              pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Daily study goal">
            {/* Ambient soft glow */}
            <View
              style={[
                styles.dailyMomentumGlow,
                {
                  backgroundColor: streak.todayCompleted ? '#10B981' : colors.primary,
                  opacity: isDark ? 0.07 : 0.05,
                },
              ]}
            />

            <View style={styles.dailyMomentumHeaderRow}>
              <View style={styles.dailyMomentumLeft}>
                <View
                  style={[
                    styles.dailyMomentumIconBox,
                    {
                      backgroundColor: streak.todayCompleted
                        ? 'rgba(16, 185, 129, 0.16)'
                        : isDark
                        ? 'rgba(56, 189, 248, 0.16)'
                        : 'rgba(14, 165, 233, 0.12)',
                    },
                  ]}>
                  <Ionicons
                    name={streak.todayCompleted ? 'checkmark-circle' : 'flash'}
                    size={18}
                    color={streak.todayCompleted ? '#10B981' : colors.primary}
                  />
                </View>
                <View style={styles.dailyMomentumTextCol}>
                  <View style={styles.dailyMomentumTitleRow}>
                    <Text style={[styles.dailyMomentumTitle, { color: colors.text }]}>
                      {streak.todayCompleted ? "Today's Target Complete!" : "Daily Study Target"}
                    </Text>
                    <View
                      style={[
                        styles.dailyMomentumTag,
                        {
                          backgroundColor: streak.todayCompleted
                            ? 'rgba(16, 185, 129, 0.14)'
                            : 'rgba(245, 158, 11, 0.14)',
                          borderColor: streak.todayCompleted
                            ? 'rgba(16, 185, 129, 0.3)'
                            : 'rgba(245, 158, 11, 0.3)',
                        },
                      ]}>
                      <Text
                        style={[
                          styles.dailyMomentumTagText,
                          { color: streak.todayCompleted ? '#10B981' : '#F59E0B' },
                        ]}>
                        {streak.todayCompleted ? 'STREAK SECURED' : '1 LESSON LEFT'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.dailyMomentumSub, { color: colors.textSecondary }]}>
                    {streak.todayCompleted
                      ? `Great job! Your ${streak.currentStreak}-day learning momentum is locked in.`
                      : 'Complete 1 lesson today to keep your daily streak alive and earn bonus XP.'}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
            </View>

            {/* Micro Progress Track */}
            <View style={[styles.dailyMomentumTrack, { backgroundColor: colors.cardSecondary }]}>
              <View
                style={[
                  styles.dailyMomentumFill,
                  {
                    width: streak.todayCompleted ? '100%' : '50%',
                    backgroundColor: streak.todayCompleted ? '#10B981' : colors.primary,
                  },
                ]}
              />
            </View>
          </Pressable>
        )}

        {/* MATCHING TOPICS (WHEN SEARCHING) */}
        {searchQuery.trim().length > 0 && matchingTopics.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderTitleCol}>
                <View style={styles.titleBadgeRow}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Matching Topics</Text>
                  <View style={[styles.countBadge, { backgroundColor: colors.cardSecondary }]}>
                    <Text style={[styles.countBadgeText, { color: colors.primary }]}>
                      {matchingTopics.length} Found
                    </Text>
                  </View>
                </View>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  {`Direct topics across curriculum matching "${searchQuery.trim()}"`}
                </Text>
              </View>
            </View>

            <View style={styles.matchingTopicsList}>
              {matchingTopics.map((topicItem) => (
                <Pressable
                  key={`${topicItem.parentType}-${topicItem.parentId}-${topicItem.id}`}
                  onPress={() => {
                    if (onNavigateTab) {
                      if (topicItem.parentType === 'language') {
                        onNavigateTab('roadmaps', {
                          languageId: topicItem.parentId,
                          topicId: topicItem.id,
                        });
                      } else {
                        onNavigateTab('math', {
                          subjectId: topicItem.parentId,
                          topicId: topicItem.id,
                        });
                      }
                    }
                  }}
                  style={({ pressed }) => [
                    styles.matchingTopicCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                    pressed && { opacity: 0.88, borderColor: topicItem.parentColor, transform: [{ scale: 0.99 }] },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${topicItem.title} in ${topicItem.parentName}`}>
                  <View style={styles.matchingTopicLeft}>
                    <View
                      style={[
                        styles.matchingTopicIconBox,
                        {
                          backgroundColor: `${topicItem.parentColor}18`,
                          borderColor: `${topicItem.parentColor}30`,
                        },
                      ]}>
                      <Ionicons
                        name={topicItem.parentType === 'language' ? 'code-slash' : 'book-outline'}
                        size={17}
                        color={topicItem.parentColor}
                      />
                    </View>
                    <View style={styles.matchingTopicInfo}>
                      <Text
                        style={[styles.matchingTopicTitle, { color: colors.text }]}
                        numberOfLines={1}>
                        {topicItem.title}
                      </Text>
                      <View style={styles.matchingTopicMetaRow}>
                        <View
                          style={[
                            styles.matchingTopicBadge,
                            { backgroundColor: `${topicItem.parentColor}18` },
                          ]}>
                          <Text
                            style={[
                              styles.matchingTopicBadgeText,
                              { color: topicItem.parentColor },
                            ]}>
                            {topicItem.parentBadge || topicItem.parentName}
                          </Text>
                        </View>
                        <Text
                          style={[styles.matchingTopicChapter, { color: colors.textMuted }]}
                          numberOfLines={1}>
                          • {topicItem.chapterTitle}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={[styles.matchingTopicActionPill, { backgroundColor: colors.cardSecondary }]}>
                    <Text style={[styles.matchingTopicActionText, { color: colors.primary }]}>Open</Text>
                    <Ionicons name="arrow-forward" size={11} color={colors.primary} />
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* 3. ACTIVE / CONTINUE STUDYING CAROUSEL */}
        {(selectedFilter === 'all' || selectedFilter === 'active') && filteredActiveItems.length > 0 && (
          <View style={styles.sectionContainer}>
            {/* ── Section Header ── */}
            <View style={styles.sectionHeaderFlexRow}>
              <View style={styles.sectionHeaderTitleCol}>
                <View style={styles.titleBadgeRow}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Continue Studying</Text>
                  <View style={[styles.activePill, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                    <View style={styles.activePillDot} />
                    <Text style={styles.activePillText}>IN PROGRESS</Text>
                  </View>
                </View>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  Resume where you left off • {filteredActiveItems.length} active {filteredActiveItems.length === 1 ? 'course' : 'courses'}
                </Text>
              </View>

              {filteredActiveItems.length > 1 && (
                <View style={styles.carouselHeaderControls}>
                  <View style={styles.carouselArrowGroup}>
                    <Pressable
                      onPress={handlePrevActive}
                      disabled={currentActiveStudyIndex === 0}
                      hitSlop={6}
                      style={({ pressed }) => [
                        styles.carouselArrowBtn,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                          opacity: currentActiveStudyIndex === 0 ? 0.35 : pressed ? 0.7 : 1,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Previous active course">
                      <Ionicons name="chevron-back" size={14} color={colors.text} />
                    </Pressable>
                    <Pressable
                      onPress={handleNextActive}
                      disabled={currentActiveStudyIndex >= filteredActiveItems.length - 1}
                      hitSlop={6}
                      style={({ pressed }) => [
                        styles.carouselArrowBtn,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                          opacity: currentActiveStudyIndex >= filteredActiveItems.length - 1 ? 0.35 : pressed ? 0.7 : 1,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Next active course">
                      <Ionicons name="chevron-forward" size={14} color={colors.text} />
                    </Pressable>
                  </View>
                </View>
              )}
            </View>

            {/* ── Cards Carousel ── */}
            <ScrollView
              ref={activeStudyScrollRef}
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.csScrollContent}
              decelerationRate="fast"
              snapToInterval={CAROUSEL_CARD_WIDTH + 14}
              snapToAlignment="start"
              onScroll={(e) => {
                const offsetX = e.nativeEvent.contentOffset.x;
                const index = Math.round(offsetX / (CAROUSEL_CARD_WIDTH + 14));
                if (index >= 0 && index < filteredActiveItems.length && index !== activeStudyIndex) {
                  setActiveStudyIndex(index);
                }
              }}
              scrollEventThrottle={16}>
              {filteredActiveItems.map((item, index) => {
                const isCurrent = index === currentActiveStudyIndex;

                return (
                  <Pressable
                    key={item.id}
                    onPress={() => handleResumeActiveItem(item)}
                    style={({ pressed }) => [
                      styles.csModernCard,
                      {
                        width: CAROUSEL_CARD_WIDTH,
                        backgroundColor: colors.card,
                        borderColor: isCurrent
                          ? (isDark ? `${item.badgeColor}88` : item.badgeColor)
                          : (isDark ? `${item.badgeColor}33` : `${item.badgeColor}40`),
                        shadowColor: item.badgeColor,
                      },
                      pressed && { opacity: 0.94, transform: [{ scale: 0.985 }] },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Resume ${item.title}`}>
                    {/* Ambient Glow Orb */}
                    <View
                      style={[
                        styles.csCardGlowOrb,
                        {
                          backgroundColor: item.badgeColor,
                          opacity: isDark ? 0.08 : 0.05,
                        },
                      ]}
                    />

                    {/* Header: Icon, Track Info, Dismiss */}
                    <View style={styles.csCardHeader}>
                      <View style={[styles.csSquircleIcon, { backgroundColor: item.badgeBg }]}>
                        {isIconUrl(item.iconName) ? (
                          <Image
                            source={{ uri: item.iconName }}
                            style={styles.csIconImg}
                            resizeMode="contain"
                          />
                        ) : (
                          <Ionicons name={item.iconName as any} size={22} color={item.badgeColor} />
                        )}
                      </View>

                      <View style={styles.csTrackInfo}>
                        <View style={styles.csBadgeRow}>
                          <View style={[styles.csBadgePill, { backgroundColor: item.badgeBg }]}>
                            <Text style={[styles.csBadgeText, { color: item.badgeColor }]}>
                              {item.badge}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.csTimeLeftRow}>
                          <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
                          <Text style={[styles.csTimeLeftText, { color: colors.textSecondary }]}>
                            {item.timeLeft
                              ? item.timeLeft.toLowerCase().includes('left')
                                ? item.timeLeft
                                : `${item.timeLeft} left`
                              : '15 min left'}
                          </Text>
                        </View>
                      </View>

                      {/* Dismiss / Close button */}
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation?.();
                          handleRemoveActiveItem(item);
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={({ pressed }) => [
                          styles.csDismissButton,
                          {
                            backgroundColor: colors.cardSecondary,
                            borderColor: colors.border,
                          },
                          pressed && { opacity: 0.55 },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Dismiss ${item.title}`}>
                        <Ionicons name="close" size={13} color={colors.textMuted} />
                      </Pressable>
                    </View>

                    {/* Active Topic Section (The lesson to jump into) */}
                    <View style={styles.csTopicSection}>
                      <Text style={[styles.csCourseTitle, { color: colors.text }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <View style={styles.csLessonFocusRow}>
                        <Ionicons name="bookmark" size={12} color={item.badgeColor} />
                        <Text style={[styles.csLessonFocusText, { color: colors.textSecondary }]} numberOfLines={1}>
                          {item.subtitle}
                        </Text>
                      </View>
                    </View>

                    {/* Progress Bar & Milestone Meta */}
                    <View style={styles.csProgressContainer}>
                      <View style={styles.csProgressMetaRow}>
                        <View style={styles.csStepBadge}>
                          <Ionicons name="layers-outline" size={11} color={item.badgeColor} />
                          <Text style={[styles.csStepText, { color: colors.textSecondary }]}>
                            {item.currentStep || 'In progress'}
                          </Text>
                        </View>
                        <Text style={[styles.csProgressPercentText, { color: item.badgeColor }]}>
                          {item.progressPercent}%
                        </Text>
                      </View>
                      <View style={[styles.csProgressBarTrack, { backgroundColor: colors.cardSecondary }]}>
                        <View
                          style={[
                            styles.csProgressBarFill,
                            {
                              width: `${item.progressPercent}%`,
                              backgroundColor: item.badgeColor,
                            },
                          ]}
                        />
                      </View>
                    </View>

                    {/* Ultra-Modern Resume CTA Button */}
                    <View
                      style={[
                        styles.csActionBtn,
                        { backgroundColor: colors.primary },
                      ]}>
                      <View style={styles.csActionIconCircle}>
                        <Ionicons name="play" size={11} color="#0F172A" />
                      </View>
                      <Text style={styles.csActionBtnText}>
                        {item.progressPercent > 0 ? 'Resume Lesson' : 'Start Lesson'}
                      </Text>
                      <Ionicons name="arrow-forward" size={13} color="#0F172A" />
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Pagination Dots below cards if multiple items */}
            {filteredActiveItems.length > 1 && (
              <View style={styles.csPaginationRow}>
                <View style={styles.csDotsGroup}>
                  {filteredActiveItems.map((item, idx) => {
                    const isActive = idx === currentActiveStudyIndex;
                    const dotColor = item.badgeColor || colors.primary;

                    return (
                      <Pressable
                        key={`cs-dot-${item.id}-${idx}`}
                        onPress={() => {
                          setActiveStudyIndex(idx);
                          activeStudyScrollRef.current?.scrollTo({
                            x: idx * (CAROUSEL_CARD_WIDTH + 14),
                            animated: true,
                          });
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                        style={[
                          styles.csDotBase,
                          isActive
                            ? [
                                styles.csDotActive,
                                {
                                  backgroundColor: dotColor,
                                  width: 22,
                                },
                              ]
                            : [
                                styles.csDotInactive,
                                {
                                  backgroundColor: colors.cardSecondary,
                                  borderColor: colors.border,
                                },
                              ],
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Go to active card ${idx + 1}`}
                      />
                    );
                  })}
                </View>
                <View style={styles.csCounterWrap}>
                  <Text style={[styles.csCounterText, { color: colors.textMuted }]}>
                    {currentActiveStudyIndex + 1} / {filteredActiveItems.length}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* 4. PROGRAMMING LANGUAGES CONTAINER (SWIPEABLE CARD CAROUSEL) */}
        {(selectedFilter === 'all' || selectedFilter === 'languages') && filteredLanguages.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderFlexRow}>
              <View style={styles.sectionHeaderTitleCol}>
                <View style={styles.titleBadgeRow}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Programming Languages</Text>
                  {searchQuery.trim() ? (
                    <View style={[styles.countBadge, { backgroundColor: colors.cardSecondary }]}>
                      <Text style={[styles.countBadgeText, { color: colors.textSecondary }]}>
                        {filteredLanguages.length} Found
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  {searchQuery.trim()
                    ? `${filteredLanguages.length} of ${availableLanguages.length} languages available`
                    : `Total ${availableLanguages.length} Languages Available`}
                </Text>
              </View>

              {filteredLanguages.length > 1 && (
                <View style={styles.carouselHeaderControls}>
                  <View style={styles.carouselArrowGroup}>
                    <Pressable
                      onPress={handlePrevLang}
                      disabled={currentActiveLangIndex === 0}
                      hitSlop={6}
                      style={({ pressed }) => [
                        styles.carouselArrowBtn,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                          opacity: currentActiveLangIndex === 0 ? 0.35 : pressed ? 0.7 : 1,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Previous language card">
                      <Ionicons name="chevron-back" size={14} color={colors.text} />
                    </Pressable>
                    <Pressable
                      onPress={handleNextLang}
                      disabled={currentActiveLangIndex >= filteredLanguages.length - 1}
                      hitSlop={6}
                      style={({ pressed }) => [
                        styles.carouselArrowBtn,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                          opacity: currentActiveLangIndex >= filteredLanguages.length - 1 ? 0.35 : pressed ? 0.7 : 1,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Next language card">
                      <Ionicons name="chevron-forward" size={14} color={colors.text} />
                    </Pressable>
                  </View>
                </View>
              )}
            </View>

            {/* Horizontal Swipeable Cards List with Native Hand Gesture snapping */}
            <ScrollView
              ref={langScrollRef}
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={LANG_CARD_WIDTH + LANG_CARD_GAP}
              snapToAlignment="start"
              style={styles.langCarouselScroll}
              contentContainerStyle={styles.langCarouselContent}
              onScroll={(e) => {
                const offsetX = e.nativeEvent.contentOffset.x;
                const index = Math.round(offsetX / (LANG_CARD_WIDTH + LANG_CARD_GAP));
                if (index >= 0 && index < filteredLanguages.length && index !== activeLangIndex) {
                  setActiveLangIndex(index);
                }
              }}
              scrollEventThrottle={16}>
              {filteredLanguages.map((lang, index) => {
                const isCurrentActive = index === currentActiveLangIndex;
                const cardColor = lang.iconColor || colors.primary;

                return (
                  <Pressable
                    key={lang.id}
                    onPress={() => {
                      if (onNavigateTab) {
                        onNavigateTab('roadmaps', { languageId: lang.id });
                      }
                    }}
                    style={({ pressed }) => [
                      styles.langModernCard,
                      {
                        width: LANG_CARD_WIDTH,
                        backgroundColor: colors.card,
                        borderColor: isCurrentActive
                          ? (isDark ? cardColor : `${cardColor}BB`)
                          : colors.border,
                        shadowColor: cardColor,
                      },
                      pressed && { opacity: 0.94, transform: [{ scale: 0.985 }] },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Explore ${lang.name} programming track`}>
                    {/* Ambient Glow Orb */}
                    <View
                      style={[
                        styles.langCardGlowOrb,
                        {
                          backgroundColor: cardColor,
                          opacity: isDark ? 0.16 : 0.08,
                        },
                      ]}
                      pointerEvents="none"
                    />

                    {/* Top Accent Gradient-like Stripe */}
                    <View
                      style={[
                        styles.langModernAccentBar,
                        {
                          backgroundColor: cardColor,
                          opacity: isCurrentActive ? 1 : 0.5,
                        },
                      ]}
                    />

                    <View style={styles.langModernCardInner}>
                      {/* Top Row: Floating Icon & Header Badges */}
                      <View style={styles.langModernHeaderRow}>
                        <View
                          style={[
                            styles.langModernIconSquircle,
                            {
                              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : '#FFFFFF',
                              borderColor: `${cardColor}45`,
                              shadowColor: cardColor,
                            },
                          ]}>
                          {isIconUrl(lang.iconName) ? (
                            <Image
                              source={{ uri: lang.iconName }}
                              style={{ width: 28, height: 28 }}
                              resizeMode="contain"
                            />
                          ) : (
                            <Ionicons name={lang.iconName as any} size={28} color={cardColor} />
                          )}
                        </View>

                        <View style={styles.langModernHeaderMeta}>
                          <View style={styles.langModernTagCluster}>
                            <View
                              style={[
                                styles.langModernCategoryBadge,
                                {
                                  backgroundColor: `${cardColor}18`,
                                  borderColor: `${cardColor}35`,
                                },
                              ]}>
                              <View style={[styles.langModernPulseDot, { backgroundColor: cardColor }]} />
                              <Text style={[styles.langModernCategoryText, { color: cardColor }]}>
                                {lang.badge}
                              </Text>
                            </View>
                          </View>

                          <Text style={[styles.langModernTitle, { color: colors.text }]} numberOfLines={1}>
                            {lang.name}
                          </Text>
                        </View>
                      </View>

                      {/* Micro-Stats 3-Column Bar */}
                      <View
                        style={[
                          styles.langModernStatsBar,
                          {
                            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.45)' : 'rgba(241, 245, 249, 0.85)',
                            borderColor: colors.borderSubtle,
                          },
                        ]}>
                        <View style={styles.langModernStatCol}>
                          <Ionicons name="layers-outline" size={12} color={cardColor} />
                          <Text style={[styles.langModernStatVal, { color: colors.text }]}>
                            {lang.modulesCount}{' '}
                            <Text style={[styles.langModernStatUnit, { color: colors.textMuted }]}>
                              Lessons
                            </Text>
                          </Text>
                        </View>
                        <View style={[styles.langStatDivider, { backgroundColor: colors.borderSubtle }]} />
                        <View style={styles.langModernStatCol}>
                          <Ionicons name="git-branch-outline" size={12} color={cardColor} />
                          <Text style={[styles.langModernStatVal, { color: colors.text }]}>
                            {lang.chaptersCount || 3}{' '}
                            <Text style={[styles.langModernStatUnit, { color: colors.textMuted }]}>
                              Chapters
                            </Text>
                          </Text>
                        </View>
                        <View style={[styles.langStatDivider, { backgroundColor: colors.borderSubtle }]} />
                        <View style={styles.langModernStatCol}>
                          <Ionicons name="terminal-outline" size={12} color={cardColor} />
                          <Text style={[styles.langModernStatVal, { color: colors.text }]}>
                            Labs{' '}
                            <Text style={[styles.langModernStatUnit, { color: colors.textMuted }]}>
                              Hands-on
                            </Text>
                          </Text>
                        </View>
                      </View>

                      {/* Language Description */}
                      <Text style={[styles.langModernDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                        {lang.description}
                      </Text>

                      {/* Core Chapters Pill Chips */}
                      {lang.chapterNames && lang.chapterNames.length > 0 && (
                        <View style={styles.langModernConceptsWrap}>
                          <Text style={[styles.langModernConceptsLabel, { color: colors.textMuted }]}>
                            {"WHAT YOU'LL LEARN"}
                          </Text>
                          <View style={styles.langModernConceptsRow}>
                            {lang.chapterNames.slice(0, 3).map((chapterTitle, cIdx) => (
                              <View
                                key={`chip-${lang.id}-${cIdx}`}
                                style={[
                                  styles.langModernConceptChip,
                                  {
                                    backgroundColor: colors.cardSecondary,
                                    borderColor: colors.border,
                                  },
                                ]}>
                                <Text
                                  style={[styles.langModernConceptChipText, { color: colors.text }]}
                                  numberOfLines={1}>
                                  ✦ {chapterTitle}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}

                      {/* Progress or Verified Track Status */}
                      {lang.progressPercent > 0 ? (
                        <View style={styles.langModernProgressWrap}>
                          <View style={styles.langModernProgressRow}>
                            <View style={styles.langProgressBadge}>
                              <Ionicons name="time-outline" size={12} color={cardColor} />
                              <Text style={[styles.langModernProgressLabel, { color: colors.textSecondary }]}>
                                {lang.currentStep || 'Course in progress'}
                              </Text>
                            </View>
                            <Text style={[styles.langModernProgressPct, { color: cardColor }]}>
                              {lang.progressPercent}%
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.langModernProgressBarTrack,
                              { backgroundColor: colors.cardSecondary },
                            ]}>
                            <View
                              style={[
                                styles.langModernProgressBarFill,
                                {
                                  width: `${lang.progressPercent}%`,
                                  backgroundColor: cardColor,
                                },
                              ]}
                            />
                          </View>
                        </View>
                      ) : (
                        <View
                          style={[
                            styles.langModernRoadmapNotice,
                            {
                              backgroundColor: `${cardColor}0C`,
                              borderColor: `${cardColor}24`,
                            },
                          ]}>
                          <Ionicons name="ribbon-outline" size={13} color={cardColor} />
                          <Text style={[styles.langModernRoadmapText, { color: cardColor }]}>
                            Foundational to Advanced • Interactive Curriculum
                          </Text>
                        </View>
                      )}

                      {/* Ultra-Modern CTA Button */}
                      <View
                        style={[
                          styles.langModernCtaBtn,
                          {
                            backgroundColor: colors.primary,
                          },
                        ]}>
                        <Text style={styles.langModernCtaText}>
                          {lang.progressPercent > 0 ? 'Resume Coding' : 'Start Roadmap'}
                        </Text>
                        <View style={styles.langModernCtaIconCircle}>
                          <Ionicons name="arrow-forward" size={13} color="#0F172A" />
                        </View>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Pagination Dots & Swipe Gesture Indicator below cards */}
            {filteredLanguages.length > 1 && (
              <View style={styles.langPaginationRow}>
                <View style={styles.langDotsGroup}>
                  {filteredLanguages.map((lang, idx) => {
                    const isActive = idx === currentActiveLangIndex;
                    const dotColor = lang.iconColor || colors.primary;

                    return (
                      <Pressable
                        key={`lang-dot-${lang.id}-${idx}`}
                        onPress={() => handleSelectLangIndex(idx)}
                        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                        style={[
                          styles.langDotBase,
                          isActive
                            ? [
                                styles.langDotActive,
                                {
                                  backgroundColor: dotColor,
                                  width: 22,
                                },
                              ]
                            : [
                                styles.langDotInactive,
                                {
                                  backgroundColor: colors.cardSecondary,
                                  borderColor: colors.border,
                                },
                              ],
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Go to card ${idx + 1}`}
                      />
                    );
                  })}
                </View>
                <View style={styles.langCounterWrap}>
                  <Text style={[styles.langCounterText, { color: colors.textMuted }]}>
                    {currentActiveLangIndex + 1} / {filteredLanguages.length}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* 5. SUBJECTS NOTES CONTAINER (SWIPEABLE CARD CAROUSEL) */}
        {(selectedFilter === 'all' || selectedFilter === 'subjects') && filteredSubjects.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderFlexRow}>
              <View style={styles.sectionHeaderTitleCol}>
                <View style={styles.titleBadgeRow}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Subjects Notes</Text>
                  {searchQuery.trim() ? (
                    <View style={[styles.countBadge, { backgroundColor: colors.cardSecondary }]}>
                      <Text style={[styles.countBadgeText, { color: colors.textSecondary }]}>
                        {filteredSubjects.length} Found
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  {searchQuery.trim()
                    ? `${filteredSubjects.length} of ${availableSubjects.length} subjects available`
                    : `Total ${availableSubjects.length} Subjects Available`}
                </Text>
              </View>

              {filteredSubjects.length > 1 && (
                <View style={styles.carouselHeaderControls}>
                  <View style={styles.carouselArrowGroup}>
                    <Pressable
                      onPress={handlePrevSubj}
                      disabled={currentActiveSubjIndex === 0}
                      hitSlop={6}
                      style={({ pressed }) => [
                        styles.carouselArrowBtn,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                          opacity: currentActiveSubjIndex === 0 ? 0.35 : pressed ? 0.7 : 1,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Previous subject card">
                      <Ionicons name="chevron-back" size={14} color={colors.text} />
                    </Pressable>
                    <Pressable
                      onPress={handleNextSubj}
                      disabled={currentActiveSubjIndex >= filteredSubjects.length - 1}
                      hitSlop={6}
                      style={({ pressed }) => [
                        styles.carouselArrowBtn,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                          opacity: currentActiveSubjIndex >= filteredSubjects.length - 1 ? 0.35 : pressed ? 0.7 : 1,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Next subject card">
                      <Ionicons name="chevron-forward" size={14} color={colors.text} />
                    </Pressable>
                  </View>
                </View>
              )}
            </View>

            {/* Horizontal Swipeable Cards List with Native Hand Gesture snapping */}
            <ScrollView
              ref={subjScrollRef}
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={LANG_CARD_WIDTH + LANG_CARD_GAP}
              snapToAlignment="start"
              style={styles.langCarouselScroll}
              contentContainerStyle={styles.langCarouselContent}
              onScroll={(e) => {
                const offsetX = e.nativeEvent.contentOffset.x;
                const index = Math.round(offsetX / (LANG_CARD_WIDTH + LANG_CARD_GAP));
                if (index >= 0 && index < filteredSubjects.length && index !== activeSubjIndex) {
                  setActiveSubjIndex(index);
                }
              }}
              scrollEventThrottle={16}>
              {filteredSubjects.map((subj, index) => {
                const isCurrentActive = index === currentActiveSubjIndex;
                const cardColor = subj.iconColor || colors.accent || colors.primary;

                return (
                  <Pressable
                    key={subj.id}
                    onPress={() => {
                      if (onNavigateTab) {
                        onNavigateTab('math', { subjectId: subj.id });
                      }
                    }}
                    style={({ pressed }) => [
                      styles.langModernCard,
                      {
                        width: LANG_CARD_WIDTH,
                        backgroundColor: colors.card,
                        borderColor: isCurrentActive
                          ? (isDark ? cardColor : `${cardColor}BB`)
                          : colors.border,
                        shadowColor: cardColor,
                      },
                      pressed && { opacity: 0.94, transform: [{ scale: 0.985 }] },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Explore ${subj.name} subject notes`}>
                    {/* Ambient Glow Orb */}
                    <View
                      style={[
                        styles.langCardGlowOrb,
                        {
                          backgroundColor: cardColor,
                          opacity: isDark ? 0.16 : 0.08,
                        },
                      ]}
                      pointerEvents="none"
                    />

                    {/* Top Accent Gradient-like Stripe */}
                    <View
                      style={[
                        styles.langModernAccentBar,
                        {
                          backgroundColor: cardColor,
                          opacity: isCurrentActive ? 1 : 0.5,
                        },
                      ]}
                    />

                    <View style={styles.langModernCardInner}>
                      {/* Top Row: Floating Icon & Header Badges */}
                      <View style={styles.langModernHeaderRow}>
                        <View
                          style={[
                            styles.langModernIconSquircle,
                            {
                              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : '#FFFFFF',
                              borderColor: `${cardColor}45`,
                              shadowColor: cardColor,
                            },
                          ]}>
                          {isIconUrl(subj.iconName) ? (
                            <Image
                              source={{ uri: subj.iconName }}
                              style={{ width: 28, height: 28 }}
                              resizeMode="contain"
                            />
                          ) : (
                            <Ionicons name={subj.iconName as any} size={28} color={cardColor} />
                          )}
                        </View>

                        <View style={styles.langModernHeaderMeta}>
                          <View style={styles.langModernTagCluster}>
                            <View
                              style={[
                                styles.langModernCategoryBadge,
                                {
                                  backgroundColor: `${cardColor}18`,
                                  borderColor: `${cardColor}35`,
                                },
                              ]}>
                              <View style={[styles.langModernPulseDot, { backgroundColor: cardColor }]} />
                              <Text style={[styles.langModernCategoryText, { color: cardColor }]}>
                                {subj.badge}
                              </Text>
                            </View>
                          </View>

                          <Text style={[styles.langModernTitle, { color: colors.text }]} numberOfLines={1}>
                            {subj.name}
                          </Text>
                        </View>
                      </View>

                      {/* Micro-Stats 3-Column Bar (Academic & Proofs focused) */}
                      <View
                        style={[
                          styles.langModernStatsBar,
                          {
                            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.45)' : 'rgba(241, 245, 249, 0.85)',
                            borderColor: colors.borderSubtle,
                          },
                        ]}>
                        <View style={styles.langModernStatCol}>
                          <Ionicons name="document-text-outline" size={12} color={cardColor} />
                          <Text style={[styles.langModernStatVal, { color: colors.text }]}>
                            {subj.topicsCount}{' '}
                            <Text style={[styles.langModernStatUnit, { color: colors.textMuted }]}>
                              Topics
                            </Text>
                          </Text>
                        </View>
                        <View style={[styles.langStatDivider, { backgroundColor: colors.borderSubtle }]} />
                        <View style={styles.langModernStatCol}>
                          <Ionicons name="git-branch-outline" size={12} color={cardColor} />
                          <Text style={[styles.langModernStatVal, { color: colors.text }]}>
                            {subj.chaptersCount || 3}{' '}
                            <Text style={[styles.langModernStatUnit, { color: colors.textMuted }]}>
                              Chapters
                            </Text>
                          </Text>
                        </View>
                        <View style={[styles.langStatDivider, { backgroundColor: colors.borderSubtle }]} />
                        <View style={styles.langModernStatCol}>
                          <Ionicons name="library-outline" size={12} color={cardColor} />
                          <Text style={[styles.langModernStatVal, { color: colors.text }]}>
                            Proofs{' '}
                            <Text style={[styles.langModernStatUnit, { color: colors.textMuted }]}>
                              Formal
                            </Text>
                          </Text>
                        </View>
                      </View>

                      {/* Subject Description */}
                      <Text style={[styles.langModernDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                        {subj.description}
                      </Text>

                      {/* Core Chapters Pill Chips (Academic syllabus focus) */}
                      {subj.chapterNames && subj.chapterNames.length > 0 && (
                        <View style={styles.langModernConceptsWrap}>
                          <Text style={[styles.langModernConceptsLabel, { color: colors.textMuted }]}>
                            {"CORE SYLLABUS & THEOREMS"}
                          </Text>
                          <View style={styles.langModernConceptsRow}>
                            {subj.chapterNames.slice(0, 3).map((chapterTitle, cIdx) => (
                              <View
                                key={`chip-${subj.id}-${cIdx}`}
                                style={[
                                  styles.langModernConceptChip,
                                  {
                                    backgroundColor: colors.cardSecondary,
                                    borderColor: colors.border,
                                  },
                                ]}>
                                <Text
                                  style={[styles.langModernConceptChipText, { color: colors.text }]}
                                  numberOfLines={1}>
                                  § {chapterTitle}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}

                      {/* Progress or Academic Verified Notice */}
                      {subj.progressPercent > 0 ? (
                        <View style={styles.langModernProgressWrap}>
                          <View style={styles.langModernProgressRow}>
                            <View style={styles.langProgressBadge}>
                              <Ionicons name="time-outline" size={12} color={cardColor} />
                              <Text style={[styles.langModernProgressLabel, { color: colors.textSecondary }]}>
                                {subj.currentStep || 'Notes in progress'}
                              </Text>
                            </View>
                            <Text style={[styles.langModernProgressPct, { color: cardColor }]}>
                              {subj.progressPercent}%
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.langModernProgressBarTrack,
                              { backgroundColor: colors.cardSecondary },
                            ]}>
                            <View
                              style={[
                                styles.langModernProgressBarFill,
                                {
                                  width: `${subj.progressPercent}%`,
                                  backgroundColor: cardColor,
                                },
                              ]}
                            />
                          </View>
                        </View>
                      ) : (
                        <View
                          style={[
                            styles.langModernRoadmapNotice,
                            {
                              backgroundColor: `${cardColor}0C`,
                              borderColor: `${cardColor}24`,
                            },
                          ]}>
                          <Ionicons name="school-outline" size={13} color={cardColor} />
                          <Text style={[styles.langModernRoadmapText, { color: cardColor }]}>
                            Formal Proofs • Definitions & Problem Sets
                          </Text>
                        </View>
                      )}

                      {/* Ultra-Modern CTA Button */}
                      <View
                        style={[
                          styles.langModernCtaBtn,
                          {
                            backgroundColor: colors.primary,
                          },
                        ]}>
                        <Text style={styles.langModernCtaText}>
                          {subj.progressPercent > 0 ? 'Resume Notes' : 'Explore Syllabus'}
                        </Text>
                        <View style={styles.langModernCtaIconCircle}>
                          <Ionicons name="arrow-forward" size={13} color="#0F172A" />
                        </View>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Pagination Dots below cards */}
            {filteredSubjects.length > 1 && (
              <View style={styles.langPaginationRow}>
                <View style={styles.langDotsGroup}>
                  {filteredSubjects.map((subj, idx) => {
                    const isActive = idx === currentActiveSubjIndex;
                    const dotColor = subj.iconColor || colors.accent || colors.primary;

                    return (
                      <Pressable
                        key={`subj-dot-${subj.id}-${idx}`}
                        onPress={() => handleSelectSubjIndex(idx)}
                        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                        style={[
                          styles.langDotBase,
                          isActive
                            ? [
                                styles.langDotActive,
                                {
                                  backgroundColor: dotColor,
                                  width: 22,
                                },
                              ]
                            : [
                                styles.langDotInactive,
                                {
                                  backgroundColor: colors.cardSecondary,
                                  borderColor: colors.border,
                                },
                              ],
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Go to card ${idx + 1}`}
                      />
                    );
                  })}
                </View>
                <View style={styles.langCounterWrap}>
                  <Text style={[styles.langCounterText, { color: colors.textMuted }]}>
                    {currentActiveSubjIndex + 1} / {filteredSubjects.length}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Empty Search / Filter State */}
        {hasNoResults && (
          <View
            style={[
              styles.emptyFilterContainer,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}>
            <View style={[styles.emptyFilterIconWrap, { backgroundColor: colors.cardSecondary }]}>
              <Ionicons name="search-outline" size={28} color={colors.textMuted} />
            </View>
            <Text style={[styles.emptyFilterTitle, { color: colors.text }]}>No Results Found</Text>
            <Text style={[styles.emptyFilterSub, { color: colors.textSecondary }]}>
              {searchQuery
                ? `We couldn't find any courses, topics, or subjects matching "${searchQuery}".`
                : selectedFilter === 'active'
                ? "You haven't started any courses yet. Choose a programming language or academic subject below to start learning!"
                : 'No items found for the selected category.'}
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
              <Text style={styles.clearFilterBtnText}>Reset Search & Filters</Text>
            </Pressable>
          </View>
        )}

        {/* 6. REFERS CONTAINER - MODERN REWARDS VOUCHER MODULE */}
        <View
          style={[
            styles.referralCardModern,
            {
              backgroundColor: colors.card,
              borderColor: isDark ? 'rgba(245, 158, 11, 0.28)' : 'rgba(245, 158, 11, 0.35)',
              shadowColor: '#F59E0B',
            },
          ]}>
          {/* Ambient Glow Orb */}
          <View
            style={[
              styles.referralGlowOrb,
              {
                backgroundColor: '#F59E0B',
                opacity: isDark ? 0.08 : 0.06,
              },
            ]}
          />

          {/* Header Row: Badge & Exchange Chip */}
          <View style={styles.referralModernHeader}>
            <View style={styles.referralModernBadge}>
              <View style={styles.referralBadgeIconWrap}>
                <Ionicons name="gift" size={13} color="#F59E0B" />
              </View>
              <Text style={styles.referralBadgeText}>COMMUNITY REWARDS</Text>
            </View>

            <View
              style={[
                styles.referralExchangePill,
                {
                  backgroundColor: colors.cardSecondary,
                  borderColor: isDark ? 'rgba(245, 158, 11, 0.22)' : 'rgba(245, 158, 11, 0.3)',
                },
              ]}>
              <Ionicons name="cash-outline" size={12} color="#F59E0B" />
              <Text style={[styles.referralExchangeText, { color: colors.textSecondary }]}>
                100 Coins = ₹1.00
              </Text>
            </View>
          </View>

          {/* Main Title & Description */}
          <Text style={[styles.referralModernTitle, { color: colors.text }]}>
            Invite Peers, Learn & Earn Together
          </Text>
          <Text style={[styles.referralModernDesc, { color: colors.textSecondary }]}>
            Share your invite code with college classmates. Both of you receive instant coin bonuses upon registration!
          </Text>

          {/* Dual Reward Split Cards (You vs Friend) */}
          <View style={styles.referralSplitRow}>
            {/* You Get Card */}
            <View
              style={[
                styles.referralSplitCard,
                {
                  backgroundColor: isDark ? 'rgba(245, 158, 11, 0.08)' : 'rgba(245, 158, 11, 0.05)',
                  borderColor: isDark ? 'rgba(245, 158, 11, 0.25)' : 'rgba(245, 158, 11, 0.3)',
                },
              ]}>
              <View style={styles.referralSplitTop}>
                <View style={[styles.splitIconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.16)' }]}>
                  <Ionicons name="sparkles" size={12} color="#F59E0B" />
                </View>
                <Text style={styles.splitRoleLabel}>YOU RECEIVE</Text>
              </View>
              <Text style={[styles.splitCoinsValue, { color: '#F59E0B' }]}>+200 Coins</Text>
              <Text style={[styles.splitWorthValue, { color: colors.textMuted }]}>
                Worth ₹2.00 / join
              </Text>
            </View>

            {/* Friend Gets Card */}
            <View
              style={[
                styles.referralSplitCard,
                {
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.05)',
                  borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.3)',
                },
              ]}>
              <View style={styles.referralSplitTop}>
                <View style={[styles.splitIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.16)' }]}>
                  <Ionicons name="ribbon" size={12} color="#10B981" />
                </View>
                <Text style={[styles.splitRoleLabel, { color: '#10B981' }]}>PEER RECEIVES</Text>
              </View>
              <Text style={[styles.splitCoinsValue, { color: '#10B981' }]}>+100 Coins</Text>
              <Text style={[styles.splitWorthValue, { color: colors.textMuted }]}>
                Welcome bonus
              </Text>
            </View>
          </View>

          {/* Voucher Coupon Ticket */}
          <View
            style={[
              styles.referralVoucherBox,
              {
                backgroundColor: colors.cardSecondary,
                borderColor: isDark ? 'rgba(245, 158, 11, 0.35)' : 'rgba(245, 158, 11, 0.45)',
              },
            ]}>
            <View style={styles.voucherLeftCol}>
              <View style={styles.voucherLabelRow}>
                <Ionicons name="ticket-outline" size={11} color={colors.textMuted} />
                <Text style={[styles.voucherLabelText, { color: colors.textMuted }]}>
                  YOUR INVITE CODE
                </Text>
              </View>
              <Text style={[styles.voucherCodeValue, { color: colors.text }]}>
                {user.referralCode}
              </Text>
            </View>

            <Pressable
              onPress={handleCopyCode}
              hitSlop={6}
              style={({ pressed }) => [
                styles.voucherCopyBtn,
                {
                  backgroundColor: copiedReferral
                    ? 'rgba(16, 185, 129, 0.16)'
                    : colors.card,
                  borderColor: copiedReferral ? '#10B981' : colors.border,
                },
                pressed && { opacity: 0.75 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Copy referral code">
              <Ionicons
                name={copiedReferral ? 'checkmark-circle' : 'copy-outline'}
                size={14}
                color={copiedReferral ? '#10B981' : colors.primary}
              />
              <Text
                style={[
                  styles.voucherCopyBtnText,
                  { color: copiedReferral ? '#10B981' : colors.primary },
                ]}>
                {copiedReferral ? 'Copied!' : 'Copy Code'}
              </Text>
            </Pressable>
          </View>

          {/* Share Action Button */}
          <Pressable
            onPress={handleShareReferral}
            style={({ pressed }) => [
              styles.referralModernShareBtn,
              { backgroundColor: colors.primary },
              pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Share invite link">
            <Ionicons name="share-social-outline" size={16} color="#0F172A" />
            <Text style={styles.referralModernShareBtnText}>Share Invite Link</Text>
            <Ionicons name="arrow-forward" size={15} color="#0F172A" />
          </Pressable>

          {/* Footer: View Ledger & History */}
          <Pressable
            onPress={() => setShowReferralModal(true)}
            style={({ pressed }) => [
              styles.referralModernFooterLink,
              pressed && { opacity: 0.7 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="View coin ledger and referral history">
            <View style={styles.referralModernFooterRow}>
              <Ionicons name="wallet-outline" size={14} color={colors.primary} />
              <Text style={[styles.referralModernFooterText, { color: colors.primary }]}>
                View Coin Ledger & Referral History
              </Text>
              <Ionicons name="chevron-forward" size={13} color={colors.primary} />
            </View>
          </Pressable>
        </View>
      </ScrollView>

      {/* Referral & Ledger Modal */}
      <ReferralModal
        visible={showReferralModal}
        onClose={() => setShowReferralModal(false)}
      />

      {/* Daily Streak Modal */}
      <StreakModal
        visible={showStreakModal}
        onClose={() => setShowStreakModal(false)}
        onPracticePress={() => onNavigateTab && onNavigateTab('roadmaps')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  // Top Header
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  topHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  avatarWrapper: {
    marginRight: 10,
    borderWidth: 1.5,
    borderRadius: 22,
    padding: 1,
    position: 'relative',
  },
  avatarOfflineBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  greetingContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  topGreetingEyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  topGreetingName: {
    fontFamily: Fonts.heading,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 1,
  },
  topHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTrophyPill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCoinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5.5,
    borderRadius: 16,
    borderWidth: 1,
  },
  headerCoinText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '800',
    color: '#F59E0B',
  },
  topStreakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5.5,
    borderRadius: 16,
    borderWidth: 1,
  },
  topStreakEmoji: {
    fontSize: 13,
  },
  topStreakText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '800',
  },

  // Scroll Content
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
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
    fontSize: 15,
    height: '100%',
  },

  // Filter Pills Scroll
  filterScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 18,
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

  // Daily Momentum / Study Target Card
  dailyMomentumCard: {
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 14,
    marginBottom: 20,
    position: 'relative',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
    gap: 10,
  },
  dailyMomentumGlow: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  dailyMomentumHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dailyMomentumLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  dailyMomentumIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dailyMomentumTextCol: {
    flex: 1,
    gap: 2,
  },
  dailyMomentumTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  dailyMomentumTitle: {
    fontFamily: Fonts.heading,
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  dailyMomentumTag: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  dailyMomentumTagText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dailyMomentumSub: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    lineHeight: 15,
  },
  dailyMomentumTrack: {
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  dailyMomentumFill: {
    height: '100%',
    borderRadius: 2.5,
  },

  // Matching Topics (Search results / Command Palette)
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
    borderRadius: 11,
    borderWidth: 1,
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
    fontWeight: '700',
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
    fontSize: 10,
    fontWeight: '700',
  },
  matchingTopicChapter: {
    fontFamily: Fonts.body,
    fontSize: 12,
    flex: 1,
  },
  matchingTopicActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 8,
  },
  matchingTopicActionText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
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

  // Sections Common
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    marginBottom: 14,
  },
  sectionHeaderFlexRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 10,
  },
  carouselHeaderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  swipeHintBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 12,
    borderWidth: 1,
  },
  swipeHintText: {
    fontFamily: Fonts.bodyDemiBold,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  carouselArrowGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  carouselArrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeaderTitleCol: {
    flex: 1,
    gap: 2,
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontFamily: Fonts.heading,
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontFamily: Fonts.body,
    fontSize: 13,
    lineHeight: 17,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  activePillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  activePillText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 0.5,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '600',
  },

  // ── Continue Studying: Senior UI/UX Redesign ──────────────────────────────
  csScrollContent: {
    gap: 14,
    paddingRight: 10,
    paddingBottom: 4,
  },
  csModernCard: {
    borderWidth: 1.5,
    borderRadius: 22,
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
    gap: 12,
  },
  csCardGlowOrb: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 130,
    height: 130,
    borderRadius: 65,
  },
  csCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  csSquircleIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  csIconImg: {
    width: 22,
    height: 22,
  },
  csTrackInfo: {
    flex: 1,
    gap: 2,
  },
  csBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  csBadgePill: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  csBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  csTimeLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  csTimeLeftText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11.5,
  },
  csDismissButton: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  csTopicSection: {
    gap: 3,
  },
  csCourseTitle: {
    fontFamily: Fonts.heading,
    fontSize: 16.5,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 21,
  },
  csLessonFocusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  csLessonFocusText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12.5,
    lineHeight: 16,
    flex: 1,
  },
  csProgressContainer: {
    gap: 6,
  },
  csProgressMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  csStepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  csStepText: {
    fontFamily: Fonts.bodyDemiBold,
    fontSize: 11.5,
    fontWeight: '600',
  },
  csProgressPercentText: {
    fontFamily: Fonts.mono,
    fontSize: 12.5,
    fontWeight: '800',
  },
  csProgressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  csProgressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  csActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: 13,
    gap: 7,
    marginTop: 2,
  },
  csActionIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(15, 23, 42, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  csActionBtnText: {
    fontFamily: Fonts.heading,
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.1,
  },
  csPaginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  csDotsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  csDotBase: {
    height: 6,
    borderRadius: 3,
  },
  csDotActive: {
    borderRadius: 3,
  },
  csDotInactive: {
    width: 6,
    borderWidth: 1,
  },
  csCounterWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  csCounterText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
  },

  // Language Swipe Carousel & Showcase Cards
  langCarouselScroll: {
    marginHorizontal: -20,
  },
  langCarouselContent: {
    paddingHorizontal: 20,
    gap: LANG_CARD_GAP,
    paddingBottom: 4,
  },
  // Ultra-Modern Language Card & Carousel Styles
  langModernCard: {
    borderWidth: 1.5,
    borderRadius: 24,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 5,
    position: 'relative',
  },
  langCardGlowOrb: {
    position: 'absolute',
    top: -35,
    right: -35,
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  langModernAccentBar: {
    height: 3.5,
    width: '100%',
  },
  langModernCardInner: {
    padding: 16,
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 380,
  },
  langModernHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  langModernIconSquircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  langModernHeaderMeta: {
    flex: 1,
    gap: 4,
  },
  langModernTagCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  langModernCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  langModernPulseDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  langModernCategoryText: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  langModernTitle: {
    fontFamily: Fonts.heading,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  langModernStatsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  langModernStatCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  langModernStatVal: {
    fontFamily: Fonts.headingDemiBold,
    fontSize: 12,
    fontWeight: '700',
  },
  langModernStatUnit: {
    fontFamily: Fonts.body,
    fontSize: 11,
    fontWeight: '400',
  },
  langStatDivider: {
    width: 1,
    height: 14,
  },
  langModernDesc: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    lineHeight: 17.5,
    height: 35,
  },
  langModernConceptsWrap: {
    gap: 5,
  },
  langModernConceptsLabel: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  langModernConceptsRow: {
    flexDirection: 'row',
    gap: 6,
    overflow: 'hidden',
  },
  langModernConceptChip: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 1,
  },
  langModernConceptChipText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  langModernProgressWrap: {
    gap: 6,
  },
  langModernProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  langProgressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  langModernProgressLabel: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
  },
  langModernProgressPct: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '800',
  },
  langModernProgressBarTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  langModernProgressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  langModernRoadmapNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  langModernRoadmapText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  langModernCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 14,
    marginTop: 2,
  },
  langModernCtaText: {
    fontFamily: Fonts.heading,
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.1,
  },
  langModernCtaIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  langPaginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  langDotsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  langDotBase: {
    height: 6,
    borderRadius: 3,
  },
  langDotActive: {
    borderRadius: 3,
  },
  langDotInactive: {
    width: 6,
    borderWidth: 1,
  },
  langCounterWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  langCounterText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
  },

  // Programming Languages & Subjects Grid
  itemsGrid: {
    gap: 10,
  },
  languageCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  languageCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  langIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  langTextCol: {
    flex: 1,
  },
  langTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  langName: {
    fontFamily: Fonts.heading,
    fontSize: 16,
    fontWeight: '700',
  },
  langBadgePill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  langBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
  },
  langDesc: {
    fontFamily: Fonts.body,
    fontSize: 13,
    lineHeight: 17,
  },
  langActionCol: {
    alignItems: 'flex-end',
    gap: 3,
  },
  langModulesMeta: {
    fontFamily: Fonts.body,
    fontSize: 12,
  },

  // Other Subjects
  subjectCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  subjectCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  subjIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  subjTextCol: {
    flex: 1,
  },
  subjName: {
    fontFamily: Fonts.heading,
    fontSize: 16,
    fontWeight: '700',
  },
  subjDesc: {
    fontFamily: Fonts.body,
    fontSize: 13,
    lineHeight: 17,
    marginTop: 2,
    marginBottom: 3,
  },
  subjMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subjMetaText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
  },
  subjActionCol: {
    paddingLeft: 4,
  },

  // Referral Container - Modern Rewards Voucher Module
  referralCardModern: {
    borderWidth: 1.5,
    borderRadius: 24,
    padding: 18,
    marginBottom: 24,
    position: 'relative',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  },
  referralGlowOrb: {
    position: 'absolute',
    top: -45,
    right: -45,
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  referralModernHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  referralModernBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
  },
  referralBadgeIconWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  referralBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 0.8,
  },
  referralExchangePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  referralExchangeText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
  },
  referralModernTitle: {
    fontFamily: Fonts.heading,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 23,
    marginBottom: 5,
    letterSpacing: -0.2,
  },
  referralModernDesc: {
    fontFamily: Fonts.body,
    fontSize: 13,
    lineHeight: 18.5,
    marginBottom: 14,
  },
  referralSplitRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  referralSplitCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  referralSplitTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  splitIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splitRoleLabel: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  splitCoinsValue: {
    fontFamily: Fonts.heading,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  splitWorthValue: {
    fontFamily: Fonts.body,
    fontSize: 11,
    fontWeight: '600',
  },
  referralVoucherBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  voucherLeftCol: {
    flex: 1,
    marginRight: 10,
  },
  voucherLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  voucherLabelText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  voucherCodeValue: {
    fontFamily: Fonts.mono,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  voucherCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
  },
  voucherCopyBtnText: {
    fontFamily: Fonts.mono,
    fontSize: 11.5,
    fontWeight: '700',
  },
  referralModernShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 14,
    marginBottom: 8,
  },
  referralModernShareBtnText: {
    fontFamily: Fonts.heading,
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.1,
  },
  referralModernFooterLink: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  referralModernFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  referralModernFooterText: {
    fontFamily: Fonts.heading,
    fontSize: 12.5,
    fontWeight: '700',
  },
});
