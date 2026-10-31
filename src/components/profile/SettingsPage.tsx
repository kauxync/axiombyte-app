import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  BackHandler,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAlert } from '@/context/AlertContext';
import { StyledAlertButton } from '../StyledAlertModal';
import { Fonts } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/context/ThemeContext';
import { checkServerStatus } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDisplayPerformance } from '@/hooks/useDisplayPerformance';
import { useAuth } from '@/context/AuthContext';

const AnimatedCard = React.memo(function AnimatedCard({
  children,
  style,
  index = 0,
}: {
  children: React.ReactNode;
  style?: any;
  index?: number;
}) {
  const shouldAnimate = index < 6;
  const [scaleAnim] = useState(() => new Animated.Value(1));
  const [fadeAnim] = useState(() => new Animated.Value(shouldAnimate ? 0 : 1));
  const [translateYAnim] = useState(() => new Animated.Value(shouldAnimate ? 14 : 0));

  useEffect(() => {
    if (!shouldAnimate) return;
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        delay: Math.min(index * 30, 160),
        useNativeDriver: true,
      }),
      Animated.spring(translateYAnim, {
        toValue: 0,
        friction: 9,
        tension: 50,
        delay: Math.min(index * 30, 160),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, translateYAnim, index, shouldAnimate]);

  return (
    <Animated.View
      style={[
        {
          opacity: fadeAnim,
          transform: [{ translateY: translateYAnim }, { scale: scaleAnim }],
        },
      ]}>
      <View style={style}>{children}</View>
    </Animated.View>
  );
});

export function SettingsPage({
  onBack,
  onNavigateToEditProfile,
}: {
  onBack: () => void;
  onNavigateToEditProfile?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors, themeMode, setThemeMode } = useAppTheme();
  const displayMetrics = useDisplayPerformance();
  const { showAlert } = useAlert();
  const { user, refreshProfile } = useAuth();
  const [checkingServer, setCheckingServer] = useState(false);
  const [isProfiling, setIsProfiling] = useState(false);
  const [syncingProfile, setSyncingProfile] = useState(Boolean(user?.id));
  const [profileLastSynced, setProfileLastSynced] = useState<string | null>(null);

  const Alert = {
    alert: (title: string, message?: string, buttons?: StyledAlertButton[]) => {
      showAlert(title, message, buttons);
    },
  };

  // Always fetch live profile data directly from DB on Settings page mount (never from cache)
  useEffect(() => {
    let isMounted = true;
    if (user?.id) {
      refreshProfile(user.id)
        .then(() => {
          if (isMounted) {
            setProfileLastSynced(new Date().toLocaleTimeString());
          }
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) {
            setSyncingProfile(false);
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [user?.id, refreshProfile]);

  const handleSyncProfileFromDb = async () => {
    if (!user?.id) return;
    setSyncingProfile(true);
    try {
      const liveUser = await refreshProfile(user.id);
      if (liveUser) {
        setProfileLastSynced(new Date().toLocaleTimeString());
        Alert.alert(
          '✅ Profile Synchronized from DB',
          `Your profile data was fetched directly from Hostinger MySQL.\n\n• Name: ${liveUser.name || 'Not set'}\n• Username: @${liveUser.username}\n• University: ${liveUser.university || 'Not set'}\n• Department: ${liveUser.collegeDepartment || 'Not set'}\n• Semester: ${liveUser.semester || 'Not set'}\n• Coins: ${liveUser.coins}\n• Profile Completed: ${liveUser.isProfileCompleted ? 'Yes' : 'No'}`
        );
      } else {
        Alert.alert('Notice', 'Could not refresh profile from remote database.');
      }
    } catch (e: any) {
      Alert.alert('Sync Error', e?.message || 'Failed to fetch live profile.');
    } finally {
      setSyncingProfile(false);
    }
  };

  const handleTestPerformance = async () => {
    setIsProfiling(true);
    try {
      const report = await displayMetrics.profileAction('UI Render & Scroll Test', 1200);
      Alert.alert(
        '📊 Display Performance Profile',
        `• Hardware Refresh Rate: ${report.targetFps}Hz\n• Measured Render Speed: ${report.actualFps} FPS\n• Average Frame Delta: ${report.averageFrameTimeMs}ms\n• Frame Budget: ${displayMetrics.frameBudgetMs}ms\n• Dropped Frames: ${report.droppedFrames} (${report.jankPercentage}%)\n• Rating: ${report.smoothnessRating}`
      );
    } catch {
      Alert.alert('Performance Test', 'Completed frame rate diagnosis.');
    } finally {
      setIsProfiling(false);
    }
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const handleClearCache = async () => {
    Alert.alert(
      'Clear Local Cache & Refetch from DB',
      'This will clear local curriculum and directory cache. Fresh user and curriculum data will be fetched directly from the database.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear & Refetch',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('@axiombyte_curriculum_cache_v1');
              await AsyncStorage.removeItem('@axiombyte_universities_cache_v1');
              await AsyncStorage.removeItem('@axiombyte_departments_cache_v1');
              if (user?.id) {
                await refreshProfile(user.id);
                setProfileLastSynced(new Date().toLocaleTimeString());
              }
              Alert.alert('Cache Cleared', 'Offline caches cleared and live profile refetched from database.');
            } catch {
              Alert.alert('Notice', 'Cache could not be removed.');
            }
          },
        },
      ]
    );
  };

  const handleCheckHostingerServer = async () => {
    setCheckingServer(true);
    try {
      const res = await checkServerStatus();
      if (res.success) {
        Alert.alert(
          '✅ Hostinger Server Online',
          `Domain: axiombytedb.kauxync.in\nStatus: ${res.data?.status || 'operational'}\nDatabase: ${res.data?.database || 'connected'}`
        );
      } else {
        Alert.alert(
          'ℹ️ Hostinger Server Status',
          `Domain: axiombytedb.kauxync.in\nNote: Running in local/preview fallback mode.\nUpload serverweb/ folder to Hostinger File Manager to connect live MySQL.`
        );
      }
    } catch {
      Alert.alert('Status Note', 'API endpoint checked. Offline fallback mode active.');
    } finally {
      setCheckingServer(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
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
          <View style={styles.headerLeftGroup}>
            <Pressable
              onPress={onBack}
              style={({ pressed }) => [
                styles.headerBackBtn,
                {
                  backgroundColor: colors.cardSecondary,
                  borderColor: colors.border,
                },
                pressed && { opacity: 0.7 },
              ]}
              hitSlop={8}>
              <Ionicons name="arrow-back" size={18} color={colors.text} />
            </Pressable>
            <View>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Appearance & Storage</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                Visual theme, offline curriculum cache & cloud sync
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 80 },
        ]}
        scrollEventThrottle={displayMetrics.scrollEventThrottle}
        removeClippedSubviews={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}>
        {/* Account & Profile Data (Always Fetched Live from DB) */}
        {user && (
          <AnimatedCard
            index={0}
            style={[styles.cardBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionIconBadge, { backgroundColor: 'rgba(32, 138, 239, 0.12)' }]}>
                <Ionicons name="person-circle-outline" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={[styles.subSectionTitle, { color: colors.text }]}>Database Profile Sync</Text>
                  <View style={[styles.dbLiveBadge, { backgroundColor: 'rgba(16, 185, 129, 0.14)' }]}>
                    <View style={styles.liveDot} />
                    <Text style={styles.dbLiveBadgeText}>LIVE DB</Text>
                  </View>
                </View>
                <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
                  {profileLastSynced ? `Directly synced from MySQL at ${profileLastSynced}` : 'Fetched live from Hostinger MySQL'}
                </Text>
              </View>
            </View>

            <View style={[styles.profileInfoBox, { backgroundColor: colors.cardSecondary, borderColor: colors.borderSubtle }]}>
              <View style={styles.profileRow}>
                <Text style={[styles.profileLabel, { color: colors.textMuted }]}>Full Name</Text>
                <Text style={[styles.profileValue, { color: colors.text }]}>{user.name || 'Not set'}</Text>
              </View>
              <View style={styles.profileRow}>
                <Text style={[styles.profileLabel, { color: colors.textMuted }]}>Username</Text>
                <Text style={[styles.profileValue, { color: colors.primary }]}>@{user.username}</Text>
              </View>
              <View style={styles.profileRow}>
                <Text style={[styles.profileLabel, { color: colors.textMuted }]}>Email</Text>
                <Text style={[styles.profileValue, { color: colors.textSecondary }]} numberOfLines={1}>{user.email}</Text>
              </View>
              <Pressable
                onPress={onNavigateToEditProfile}
                disabled={!onNavigateToEditProfile}
                style={({ pressed }) => [
                  styles.profileRow,
                  pressed && onNavigateToEditProfile && { opacity: 0.7 },
                ]}>
                <Text style={[styles.profileLabel, { color: colors.textMuted }]}>University</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' }}>
                  <Text style={[styles.profileValue, { color: colors.text }]} numberOfLines={1}>{user.university || 'Not set'}</Text>
                  {onNavigateToEditProfile && <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />}
                </View>
              </Pressable>
              <Pressable
                onPress={onNavigateToEditProfile}
                disabled={!onNavigateToEditProfile}
                style={({ pressed }) => [
                  styles.profileRow,
                  pressed && onNavigateToEditProfile && { opacity: 0.7 },
                ]}>
                <Text style={[styles.profileLabel, { color: colors.textMuted }]}>College / Dept</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' }}>
                  <Text style={[styles.profileValue, { color: colors.text }]} numberOfLines={1}>{user.collegeDepartment || 'Not set'}</Text>
                  {onNavigateToEditProfile && <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />}
                </View>
              </Pressable>
              <View style={styles.profileRow}>
                <Text style={[styles.profileLabel, { color: colors.textMuted }]}>Semester</Text>
                <Text style={[styles.profileValue, { color: colors.text }]}>{user.semester || 'Not set'}</Text>
              </View>
              <View style={[styles.profileRow, { borderBottomWidth: 0 }]}>
                <Text style={[styles.profileLabel, { color: colors.textMuted }]}>Profile Setup</Text>
                <Text style={[styles.profileValue, { color: user.isProfileCompleted ? '#10B981' : '#F59E0B' }]}>
                  {user.isProfileCompleted ? 'Completed in DB' : 'Incomplete'}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={handleSyncProfileFromDb}
              disabled={syncingProfile}
              style={({ pressed }) => [
                styles.outlineActionBtn,
                { borderColor: colors.primary, backgroundColor: colors.primaryBg },
                pressed && { opacity: 0.75 },
              ]}>
              {syncingProfile ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="refresh-circle-outline" size={17} color={colors.primary} />
              )}
              <Text style={[styles.outlineActionBtnText, { color: colors.primary, fontWeight: '700' }]}>
                {syncingProfile ? 'Fetching Directly from MySQL...' : 'Refetch Profile Live from Database'}
              </Text>
            </Pressable>

            {onNavigateToEditProfile && (
              <Pressable
                onPress={onNavigateToEditProfile}
                style={({ pressed }) => [
                  styles.outlineActionBtn,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.cardSecondary,
                    marginTop: 8,
                  },
                  pressed && { opacity: 0.75 },
                ]}>
                <Ionicons name="create-outline" size={17} color={colors.text} />
                <Text style={[styles.outlineActionBtnText, { color: colors.text, fontWeight: '600' }]}>
                  Edit University & Department (Live Search)
                </Text>
              </Pressable>
            )}
          </AnimatedCard>
        )}

        {/* 1. Appearance Section */}
        <AnimatedCard
          index={0}
          style={[styles.cardBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconBadge, { backgroundColor: 'rgba(129, 140, 248, 0.12)' }]}>
              <Ionicons name="color-palette-outline" size={16} color="#818CF8" />
            </View>
            <View>
              <Text style={[styles.subSectionTitle, { color: colors.text }]}>Theme & Appearance</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
                Active mode across roadmaps & Code Lab
              </Text>
            </View>
          </View>

          <View style={styles.themeToggleGrid}>
            {[
              { key: 'system', label: 'System', icon: 'contrast' },
              { key: 'light', label: 'Light', icon: 'sunny' },
              { key: 'dark', label: 'Dark', icon: 'moon' },
            ].map((t) => {
              const isSelected = themeMode === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setThemeMode(t.key as any)}
                  style={({ pressed }) => [
                    styles.themeCardBtn,
                    {
                      backgroundColor: isSelected ? colors.primaryBg : colors.cardSecondary,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                    pressed && { opacity: 0.8 },
                  ]}>
                  <Ionicons
                    name={t.icon as any}
                    size={20}
                    color={isSelected ? colors.primary : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.themeCardBtnText,
                      { color: isSelected ? colors.primary : colors.text },
                    ]}>
                    {t.label}
                  </Text>
                  {isSelected && (
                    <View style={[styles.selectedCheckDot, { backgroundColor: colors.primary }]} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </AnimatedCard>

        {/* 2. Display Refresh Rate & Smoothness Section */}
        <AnimatedCard
          index={1}
          style={[styles.cardBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconBadge, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
              <Ionicons name="speedometer-outline" size={16} color="#10B981" />
            </View>
            <View>
              <Text style={[styles.subSectionTitle, { color: colors.text }]}>Display & Refresh Rate</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
                Hardware frame syncing & rendering smoothness
              </Text>
            </View>
          </View>

          <View style={styles.specGridRow}>
            <View style={[styles.metricChip, { backgroundColor: colors.cardSecondary, borderColor: colors.borderSubtle }]}>
              <Text style={[styles.metricChipVal, { color: colors.primary }]}>{displayMetrics.refreshRate} Hz</Text>
              <Text style={[styles.metricChipLbl, { color: colors.textMuted }]}>DISPLAY REFRESH</Text>
            </View>
            <View style={[styles.metricChip, { backgroundColor: colors.cardSecondary, borderColor: colors.borderSubtle }]}>
              <Text style={[styles.metricChipVal, { color: '#10B981' }]}>{displayMetrics.frameBudgetMs} ms</Text>
              <Text style={[styles.metricChipLbl, { color: colors.textMuted }]}>FRAME BUDGET</Text>
            </View>
          </View>

          <Text style={[styles.policyParagraph, { color: colors.textSecondary }]}>
            {displayMetrics.isHighRefreshRateSupported
              ? `High refresh rate (${displayMetrics.refreshRate}Hz) is active on your device. Scroll events, Reanimated worklets, and gesture physics run with low-latency ${displayMetrics.frameBudgetMs}ms frame budgets.`
              : `Standard 60Hz display mode is active (${displayMetrics.frameBudgetMs}ms budget per frame). UI rendering is optimized to prevent frame drops and conserve battery.`}
          </Text>

          <Pressable
            onPress={handleTestPerformance}
            disabled={isProfiling}
            style={({ pressed }) => [
              styles.outlineActionBtn,
              { borderColor: colors.border, backgroundColor: colors.cardSecondary },
              pressed && { opacity: 0.75 },
            ]}>
            {isProfiling ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="pulse-outline" size={16} color={colors.primary} />
            )}
            <Text style={[styles.outlineActionBtnText, { color: colors.text }]}>
              {isProfiling ? 'Profiling Frames...' : 'Test UI Smoothness (FPS Profile)'}
            </Text>
          </Pressable>
        </AnimatedCard>

        {/* 3. Storage & Data Section */}
        <AnimatedCard
          index={1}
          style={[styles.cardBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconBadge, { backgroundColor: 'rgba(56, 189, 248, 0.12)' }]}>
              <Ionicons name="cloud-offline-outline" size={16} color="#38BDF8" />
            </View>
            <View>
              <Text style={[styles.subSectionTitle, { color: colors.text }]}>Storage & Offline Cache</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
                Instant zero-latency offline performance
              </Text>
            </View>
          </View>

          <Text style={[styles.policyParagraph, { color: colors.textSecondary }]}>
            AxiomByte stores all syllabus roadmaps, interactive code lessons, and Discrete Mathematics notes offline on your device for distraction-free study.
          </Text>

          <Pressable
            onPress={handleClearCache}
            style={({ pressed }) => [
              styles.outlineActionBtn,
              { borderColor: colors.border, backgroundColor: colors.cardSecondary },
              pressed && { opacity: 0.75 },
            ]}>
            <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.outlineActionBtnText, { color: colors.text }]}>
              Clear Local Curriculum Cache
            </Text>
          </Pressable>
        </AnimatedCard>

        {/* 3. Server Connectivity Section */}
        <AnimatedCard
          index={2}
          style={[styles.cardBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconBadge, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
              <Ionicons name="server-outline" size={16} color="#10B981" />
            </View>
            <View>
              <Text style={[styles.subSectionTitle, { color: colors.text }]}>Hostinger Cloud Server</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
                Remote MySQL cloud synchronization
              </Text>
            </View>
          </View>

          <Text style={[styles.policyParagraph, { color: colors.textSecondary }]}>
            Verify live connectivity with the Hostinger MySQL database cluster (axiombytedb.kauxync.in).
          </Text>

          <Pressable
            onPress={handleCheckHostingerServer}
            disabled={checkingServer}
            style={({ pressed }) => [
              styles.outlineActionBtn,
              { borderColor: colors.border, backgroundColor: colors.cardSecondary },
              pressed && { opacity: 0.75 },
            ]}>
            {checkingServer ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Ionicons name="pulse" size={16} color="#10B981" />
                <Text style={[styles.outlineActionBtnText, { color: colors.text }]}>
                  Test Hostinger Server Status
                </Text>
              </>
            )}
          </Pressable>
        </AnimatedCard>
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
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerBackBtn: {
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
  headerSubtitle: {
    fontFamily: Fonts.body,
    fontSize: 12,
    marginTop: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  cardBlock: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  sectionIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subSectionTitle: {
    fontFamily: Fonts.heading,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
  },
  themeToggleGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  themeCardBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 13,
    position: 'relative',
  },
  themeCardBtnText: {
    fontFamily: Fonts.heading,
    fontSize: 14,
    fontWeight: '700',
  },
  selectedCheckDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    position: 'absolute',
    top: 6,
    right: 6,
  },
  policyParagraph: {
    fontFamily: Fonts.body,
    fontSize: 13,
    lineHeight: 18.5,
    marginBottom: 10,
  },
  outlineActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 4,
  },
  outlineActionBtnText: {
    fontFamily: Fonts.heading,
    fontSize: 14,
    fontWeight: '700',
  },
  specGridRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    marginTop: 4,
  },
  metricChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  metricChipVal: {
    fontFamily: Fonts.heading,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  metricChipLbl: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dbLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  dbLiveBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 0.6,
  },
  profileInfoBox: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 12,
    marginTop: 4,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.1)',
  },
  profileLabel: {
    fontFamily: Fonts.heading,
    fontSize: 12,
    fontWeight: '600',
  },
  profileValue: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    fontWeight: '600',
    maxWidth: '65%',
    textAlign: 'right',
  },
});

