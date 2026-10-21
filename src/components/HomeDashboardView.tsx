import React, { useState, useMemo, useEffect } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  const showSyncFeedback = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    }
    setSyncStatusMsg(message);
    setTimeout(() => setSyncStatusMsg(null), 3500);
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
    return languages.map((r) => ({
      id: r.id,
      name: r.name,
      badge: r.badge,
      description: r.description,
      iconName: r.icon,
      iconColor: r.color,
      iconBg: `${r.color}20`,
      modulesCount: getAllTopics(r).length,
      targetTab: r.targetTab || 'roadmaps',
    }));
  }, [languages]);

  // Available Subjects dynamically delivered via API & Local Storage Cache
  const availableSubjects = useMemo(() => {
    return (subjects || []).map((s) => {
      const topicCount = s.topics ? s.topics.length : getAllSubjectTopics(s).length;
      return {
        id: s.id,
        name: s.name,
        badge: s.badge,
        description: s.description,
        iconName: s.icon,
        iconColor: s.color,
        iconBg: `${s.color}20`,
        topicsCount: topicCount,
        estHours: s.estHours || '12 hrs',
        targetTab: s.targetTab || 'math',
      };
    });
  }, [subjects]);

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

  const handleCopyCode = () => {
    setCopiedReferral(true);
    Alert.alert('Referral Code Copied!', `Your code "${user.referralCode}" is ready to share with friends.`);
    setTimeout(() => setCopiedReferral(false), 3000);
  };

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
      {/* 1. TOP BAR: (avatar, hello first name, streak counter) */}
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
            style={({ pressed }) => [
              styles.avatarWrapper,
              { borderColor: colors.border },
              pressed && { opacity: 0.8 },
            ]}>
            <AvatarIcon avatarId={user.avatar} size={38} />
          </Pressable>

          <View style={styles.greetingContainer}>
            <Text style={[styles.topGreeting, { color: colors.text }]} numberOfLines={1}>
              Hello, {firstName}
            </Text>
          </View>
        </View>

        <View style={styles.topHeaderRight}>
          {/* Quick Sync Button */}
          <Pressable
            onPress={() => handleUpdateCache(false)}
            onLongPress={handleOpenCacheOptions}
            disabled={isSyncing}
            accessibilityLabel="Update Cache"
            hitSlop={8}
            style={({ pressed }) => [
              styles.syncHeaderBtn,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
              pressed && { opacity: 0.7 },
            ]}>
            {isSyncing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons
                name={isOffline ? 'cloud-offline-outline' : 'sync-outline'}
                size={17}
                color={isOffline ? colors.warning : colors.primary}
              />
            )}
          </Pressable>

          {/* Streak Counter Button */}
          <Pressable
            onPress={() => setShowStreakModal(true)}
            style={({ pressed }) => [
              styles.topStreakPill,
              {
                backgroundColor:
                  streak.lostStreak && streak.lostStreak > 0
                    ? 'rgba(239, 68, 68, 0.18)'
                    : streak.todayCompleted
                    ? isDark
                      ? 'rgba(255, 90, 60, 0.16)'
                      : 'rgba(255, 90, 60, 0.10)'
                    : colors.errorBg,
                borderColor:
                  streak.lostStreak && streak.lostStreak > 0
                    ? '#EF4444'
                    : streak.todayCompleted
                    ? '#FF5A3C'
                    : colors.errorBorder,
              },
              pressed && { opacity: 0.8 },
            ]}>
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
                      : colors.error,
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

        {/* Cache Status & Update Option */}
        <View
          style={[
            styles.cacheBarRow,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}>
          <Pressable
            style={styles.cacheStatusInfo}
            onPress={handleOpenCacheOptions}
            hitSlop={4}>
            <View
              style={[
                styles.cacheStatusDot,
                {
                  backgroundColor: isSyncing
                    ? colors.primary
                    : isOffline
                    ? colors.warning
                    : '#10B981',
                },
              ]}
            />
            <Text
              style={[styles.cacheStatusText, { color: colors.textSecondary }]}
              numberOfLines={1}>
              {isSyncing
                ? 'Syncing curriculum...'
                : syncStatusMsg
                ? syncStatusMsg
                : isOffline
                ? 'Offline Cache Active'
                : 'Local Cache Synced'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleUpdateCache(false)}
            onLongPress={handleOpenCacheOptions}
            disabled={isSyncing}
            hitSlop={4}
            style={({ pressed }) => [
              styles.updateCacheBtn,
              {
                backgroundColor: isDark
                  ? 'rgba(56, 189, 248, 0.12)'
                  : 'rgba(14, 165, 233, 0.08)',
                borderColor: isDark
                  ? 'rgba(56, 189, 248, 0.35)'
                  : 'rgba(14, 165, 233, 0.25)',
              },
              pressed && { opacity: 0.75 },
            ]}>
            {isSyncing ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={{ marginRight: 5 }}
              />
            ) : (
              <Ionicons
                name="refresh-outline"
                size={14}
                color={colors.primary}
                style={{ marginRight: 5 }}
              />
            )}
            <Text style={[styles.updateCacheBtnText, { color: colors.primary }]}>
              {isSyncing ? 'Updating...' : 'Update Cache'}
            </Text>
          </Pressable>
        </View>

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
                    pressed && { opacity: 0.85, borderColor: topicItem.parentColor },
                  ]}>
                  <View style={styles.matchingTopicLeft}>
                    <View
                      style={[
                        styles.matchingTopicIconBox,
                        { backgroundColor: `${topicItem.parentColor}18` },
                      ]}>
                      <Ionicons
                        name="document-text-outline"
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
                            {topicItem.parentName}
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
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* 3. ACTIVE / CONTINUE STUDYING CAROUSEL */}
        {(selectedFilter === 'all' || selectedFilter === 'active') && filteredActiveItems.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderTitleCol}>
                <View style={styles.titleBadgeRow}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Continue Studying</Text>
                  <View style={[styles.activePill, { backgroundColor: 'rgba(16, 185, 129, 0.14)' }]}>
                    <Text style={styles.activePillText}>IN PROGRESS</Text>
                  </View>
                </View>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  Resume where you left off across available courses
                </Text>
              </View>
            </View>

            {/* Horizontal Scroll Carousel */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselScrollContent}
              decelerationRate="fast"
              snapToInterval={CAROUSEL_CARD_WIDTH + 14}
              snapToAlignment="start">
              {filteredActiveItems.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.carouselCard,
                    {
                      width: CAROUSEL_CARD_WIDTH,
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}>
                  {/* Card Header Tag Row */}
                  <View style={styles.carouselCardTop}>
                    <View style={[styles.categoryTag, { backgroundColor: item.badgeBg }]}>
                      {isIconUrl(item.iconName) ? (
                        <Image
                          source={{ uri: item.iconName }}
                          style={{ width: 13, height: 13 }}
                          resizeMode="contain"
                        />
                      ) : (
                        <Ionicons name={item.iconName as any} size={13} color={item.badgeColor} />
                      )}
                      <Text style={[styles.categoryTagText, { color: item.badgeColor }]}>
                        {item.badge}
                      </Text>
                    </View>
                    {/* Remove from Continue Studying Button */}
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation?.();
                        handleRemoveActiveItem(item);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={({ pressed }) => [
                        styles.removeTag,
                        {
                          backgroundColor: isDark
                            ? 'rgba(239, 68, 68, 0.12)'
                            : 'rgba(239, 68, 68, 0.08)',
                          borderColor: isDark
                            ? 'rgba(239, 68, 68, 0.28)'
                            : 'rgba(239, 68, 68, 0.20)',
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${item.title} from Continue Studying`}>
                      <Ionicons name="trash-outline" size={11} color={colors.error || '#EF4444'} />
                      <Text style={[styles.removeTagText, { color: colors.error || '#EF4444' }]}>
                        Remove
                      </Text>
                    </Pressable>
                  </View>

                  {/* Topic Title */}
                  <Text style={[styles.carouselCardTitle, { color: colors.text }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={[styles.carouselCardSub, { color: colors.textSecondary }]} numberOfLines={2}>
                    {item.subtitle}
                  </Text>

                  {/* Progress Bar & Meta */}
                  <View style={styles.progressContainer}>
                    <View style={styles.progressLabelRow}>
                      <Text style={[styles.progressStepText, { color: colors.textMuted }]}>
                        {item.currentStep}
                      </Text>
                      <Text style={[styles.progressPctText, { color: item.badgeColor }]}>
                        {item.progressPercent}%
                      </Text>
                    </View>
                    <View style={[styles.progressBarTrack, { backgroundColor: colors.cardSecondary }]}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${item.progressPercent}%`,
                            backgroundColor: item.badgeColor,
                          },
                        ]}
                      />
                    </View>
                  </View>

                  {/* Resume / Start Button */}
                  <Pressable
                    onPress={() => {
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
                    }}
                    style={({ pressed }) => [
                      styles.resumeBtn,
                      { backgroundColor: colors.primary },
                      pressed && { opacity: 0.85 },
                    ]}>
                    <Ionicons name="play" size={13} color="#0F172A" />
                    <Text style={styles.resumeBtnText}>
                      {item.progressPercent > 0 ? 'Resume Lesson' : 'Start Lesson'}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* 4. PROGRAMMING LANGUAGES CONTAINER */}
        {(selectedFilter === 'all' || selectedFilter === 'languages') && filteredLanguages.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderTitleCol}>
                <View style={styles.titleBadgeRow}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Programming Languages</Text>
                  <View style={[styles.countBadge, { backgroundColor: colors.cardSecondary }]}>
                    <Text style={[styles.countBadgeText, { color: colors.textSecondary }]}>
                      {filteredLanguages.length} Available
                    </Text>
                  </View>
                </View>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  Hardware-level memory models, pointers, and systems programming
                </Text>
              </View>
            </View>

            {/* Languages Cards List */}
            <View style={styles.itemsGrid}>
              {filteredLanguages.map((lang) => (
                <Pressable
                  key={lang.id}
                  onPress={() => {
                    if (onNavigateTab) {
                      onNavigateTab(lang.targetTab);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.languageCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                    pressed && { opacity: 0.8 },
                  ]}>
                  <View style={styles.languageCardLeft}>
                    <View style={[styles.langIconBox, { backgroundColor: lang.iconBg }]}>
                      {isIconUrl(lang.iconName) ? (
                        <Image
                          source={{ uri: lang.iconName }}
                          style={{ width: 22, height: 22 }}
                          resizeMode="contain"
                        />
                      ) : (
                        <Ionicons name={lang.iconName as any} size={22} color={lang.iconColor} />
                      )}
                    </View>
                    <View style={styles.langTextCol}>
                      <View style={styles.langTitleRow}>
                        <Text style={[styles.langName, { color: colors.text }]}>{lang.name}</Text>
                        <View style={[styles.langBadgePill, { backgroundColor: lang.iconBg }]}>
                          <Text style={[styles.langBadgeText, { color: lang.iconColor }]}>
                            {lang.badge}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.langDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                        {lang.description}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.langActionCol}>
                    <Text style={[styles.langModulesMeta, { color: colors.textMuted }]}>
                      {lang.modulesCount} lessons
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* 5. OTHER SUBJECTS CONTAINER */}
        {(selectedFilter === 'all' || selectedFilter === 'subjects') && filteredSubjects.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderTitleCol}>
                <View style={styles.titleBadgeRow}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Subjects Notes</Text>
                  <View style={[styles.countBadge, { backgroundColor: colors.cardSecondary }]}>
                    <Text style={[styles.countBadgeText, { color: colors.textSecondary }]}>
                      {filteredSubjects.length} Available
                    </Text>
                  </View>
                </View>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  Academic foundations in discrete math, computation theory, and computer systems
                </Text>
              </View>
            </View>

            {/* Subjects List */}
            <View style={styles.itemsGrid}>
              {filteredSubjects.map((subj) => (
                <Pressable
                  key={subj.id}
                  onPress={() => {
                    if (onNavigateTab) {
                      onNavigateTab(subj.targetTab);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.subjectCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                    pressed && { opacity: 0.8 },
                  ]}>
                  <View style={styles.subjectCardLeft}>
                    <View style={[styles.subjIconBox, { backgroundColor: subj.iconBg }]}>
                      {isIconUrl(subj.iconName) ? (
                        <Image
                          source={{ uri: subj.iconName }}
                          style={{ width: 22, height: 22 }}
                          resizeMode="contain"
                        />
                      ) : (
                        <Ionicons name={subj.iconName as any} size={22} color={subj.iconColor} />
                      )}
                    </View>
                    <View style={styles.subjTextCol}>
                      <View style={styles.langTitleRow}>
                        <Text style={[styles.subjName, { color: colors.text }]}>{subj.name}</Text>
                        <View style={[styles.langBadgePill, { backgroundColor: subj.iconBg }]}>
                          <Text style={[styles.langBadgeText, { color: subj.iconColor }]}>
                            {subj.badge}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.subjDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                        {subj.description}
                      </Text>
                      <View style={styles.subjMetaRow}>
                        <Text style={[styles.subjMetaText, { color: colors.textMuted }]}>
                          {subj.topicsCount} Topics • {subj.estHours}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.subjActionCol}>
                    <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
                  </View>
                </Pressable>
              ))}
            </View>
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

        {/* 6. REFERS CONTAINER */}
        <View
          style={[
            styles.referralContainer,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}>
          <View style={styles.referralTop}>
            <View style={[styles.referralTag, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
              <Ionicons name="gift" size={14} color="#F59E0B" />
              <Text style={styles.referralTagText}>EARN ₹2.00 (200 COINS) PER FRIEND</Text>
            </View>
            <Text style={[styles.referralRateText, { color: colors.textMuted }]}>
              100 Coins = 1 INR
            </Text>
          </View>

          <Text style={[styles.referralTitle, { color: colors.text }]}>
            Invite Peers, Learn & Earn Together
          </Text>
          <Text style={[styles.referralSub, { color: colors.textSecondary }]}>
            Share your invite code with college classmates. You receive 200 coins and they receive 100 welcome coins upon registration.
          </Text>

          {/* Referral Code Box */}
          <View style={styles.referralActionRow}>
            <View
              style={[
                styles.referralCodeBadge,
                {
                  backgroundColor: colors.cardSecondary,
                  borderColor: colors.border,
                },
              ]}>
              <View>
                <Text style={[styles.codeBadgeLabel, { color: colors.textMuted }]}>YOUR CODE</Text>
                <Text style={[styles.codeBadgeValue, { color: colors.primary }]}>
                  {user.referralCode}
                </Text>
              </View>

              <Pressable
                onPress={handleCopyCode}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.copyCodeBtn,
                  { backgroundColor: colors.card },
                  pressed && { opacity: 0.7 },
                ]}>
                <Ionicons
                  name={copiedReferral ? 'checkmark' : 'copy-outline'}
                  size={15}
                  color={copiedReferral ? '#10B981' : colors.primary}
                />
                <Text
                  style={[
                    styles.copyCodeBtnText,
                    { color: copiedReferral ? '#10B981' : colors.primary },
                  ]}>
                  {copiedReferral ? 'Copied' : 'Copy'}
                </Text>
              </Pressable>
            </View>

            {/* Share / Invite Button */}
            <Pressable
              onPress={handleShareReferral}
              style={({ pressed }) => [
                styles.shareInviteBtn,
                { backgroundColor: colors.primary },
                pressed && { opacity: 0.85 },
              ]}>
              <Ionicons name="share-social" size={15} color="#0F172A" />
              <Text style={styles.shareInviteBtnText}>Invite Peers</Text>
            </Pressable>
          </View>

          {/* View Referral History & Wallet */}
          <Pressable
            onPress={() => setShowReferralModal(true)}
            style={styles.viewLedgerBtn}>
            <Text style={[styles.viewLedgerBtnText, { color: colors.primary }]}>
              View Coin Ledger & Referral History →
            </Text>
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
    paddingBottom: 12,
  },
  topHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  avatarWrapper: {
    marginRight: 10,
    borderWidth: 1.5,
    borderRadius: 22,
    padding: 1,
  },
  greetingContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  topGreeting: {
    fontFamily: Fonts.heading,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  topHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topStreakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  topStreakEmoji: {
    fontSize: 15,
  },
  topStreakText: {
    fontFamily: Fonts.mono,
    fontSize: 13,
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

  // Cache Status & Update Option Bar
  cacheBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    gap: 10,
  },
  cacheStatusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  cacheStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cacheStatusText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '600',
  },
  updateCacheBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  updateCacheBtnText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    fontWeight: '700',
  },

  // Matching Topics (Search results)
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

  // Sections Common
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    marginBottom: 14,
  },
  sectionHeaderTitleCol: {
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
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
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

  // Active Carousel
  carouselScrollContent: {
    gap: 14,
    paddingRight: 10,
  },
  carouselCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    justifyContent: 'space-between',
  },
  carouselCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  categoryTagText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  removeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 1,
  },
  removeTagText: {
    fontFamily: Fonts.bodyDemiBold,
    fontSize: 11,
    letterSpacing: 0.2,
    fontWeight: '700',
  },
  carouselCardTitle: {
    fontFamily: Fonts.heading,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21,
    marginBottom: 4,
  },
  carouselCardSub: {
    fontFamily: Fonts.body,
    fontSize: 13,
    lineHeight: 17,
    marginBottom: 12,
  },
  progressContainer: {
    marginBottom: 14,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressStepText: {
    fontFamily: Fonts.body,
    fontSize: 12,
  },
  progressPctText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '800',
  },
  progressBarTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  resumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  resumeBtnText: {
    fontFamily: Fonts.heading,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
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

  // Referral Container
  referralContainer: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    marginBottom: 24,
  },
  referralTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 6,
  },
  referralTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  referralTagText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  referralRateText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
  },
  referralTitle: {
    fontFamily: Fonts.heading,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 23,
    marginBottom: 4,
  },
  referralSub: {
    fontFamily: Fonts.body,
    fontSize: 14,
    lineHeight: 19,
    marginBottom: 16,
  },
  referralActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  referralCodeBadge: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  codeBadgeLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  codeBadgeValue: {
    fontFamily: Fonts.mono,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  copyCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  copyCodeBtnText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
  },
  shareInviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 12,
  },
  shareInviteBtnText: {
    fontFamily: Fonts.heading,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  viewLedgerBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  viewLedgerBtnText: {
    fontFamily: Fonts.heading,
    fontSize: 13,
    fontWeight: '700',
  },
});
