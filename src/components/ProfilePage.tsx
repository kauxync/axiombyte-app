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
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useAlert } from '@/context/AlertContext';
import { StyledAlertButton } from './StyledAlertModal';
import { AvatarIcon } from './AvatarPicker';
import { StreakModal } from './StreakModal';
import { ReferralModal } from './ReferralModal';
import { DeleteAccountModal } from './profile/DeleteAccountModal';
import { Fonts } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/context/ThemeContext';
import { checkAppUpdate, notifyUpdateAvailable } from '@/services/updates';

// Dedicated Section Pages
import { EditProfilePage } from './profile/EditProfilePage';
import { WalletPage } from './profile/WalletPage';
import { SettingsPage } from './profile/SettingsPage';
import { AppInfoPage } from './profile/AppInfoPage';
import { LegalPolicyPage, PolicyKey } from './profile/LegalPolicyPage';

export type ProfileSubPage =
  | null
  | 'edit_profile'
  | 'wallet'
  | 'settings'
  | 'app_info'
  | 'terms'
  | 'privacy'
  | 'referral_policy';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_CARD_WIDTH = Math.min(SCREEN_WIDTH - 36, 420);
const CAROUSEL_GAP = 12;

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
  const [translateYAnim] = useState(() => new Animated.Value(18));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 260,
        delay: Math.min(index * 40, 260),
        useNativeDriver: true,
      }),
      Animated.spring(translateYAnim, {
        toValue: 0,
        friction: 8,
        tension: 45,
        delay: Math.min(index * 40, 260),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, translateYAnim, index]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.978,
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

export function ProfilePage({
  onGoBack,
  canGoBack = true,
}: {
  onGoBack?: () => void;
  canGoBack?: boolean;
} = {}) {
  const { user, streak, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors, isDark, themeMode } = useAppTheme();
  const { showAlert } = useAlert();

  const Alert = {
    alert: (title: string, message?: string, buttons?: StyledAlertButton[]) => {
      showAlert(title, message, buttons);
    },
  };

  // Active Sub-page State (Renders dedicated separate pages)
  const [activeSubPage, setActiveSubPage] = useState<ProfileSubPage>(null);

  // Modals
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

  const handleCarouselScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (CAROUSEL_CARD_WIDTH + CAROUSEL_GAP));
    if (index !== carouselIndex && index >= 0 && index <= 2) {
      setCarouselIndex(index);
    }
  };

  // Handle hardware Back button: If inside a sub-page, return to profile main view
  useEffect(() => {
    if (!activeSubPage) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setActiveSubPage(null);
      return true;
    });
    return () => sub.remove();
  }, [activeSubPage]);

  if (!user) return null;

  const inrBalance = (user.coins / 100).toFixed(2);
  const appName = Constants.expoConfig?.name || 'AxiomByte';
  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const packageName = Constants.expoConfig?.android?.package || 'in.kauxync.axiombyte';

  const handleCheckUpdates = async () => {
    setCheckingUpdate(true);
    try {
      const res = await checkAppUpdate();

      if (res.isDev) {
        Alert.alert(
          'Dev Environment',
          'In-app Over-The-Air (OTA) updates are disabled in development mode. They automatically run in standalone preview and production APK builds without reinstalling.'
        );
        return;
      }

      if (!res.isAvailable) {
        Alert.alert(
          'Up to Date ✨',
          `${appName} v${appVersion} is running the latest version! No update needed at this time.`
        );
        return;
      }

      notifyUpdateAvailable();
    } catch (e: any) {
      Alert.alert('Update Error', e?.message || 'Could not reach update service.');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleConfirmSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of your AxiomByte academic account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  };

  const handleConfirmDeleteAccount = () => {
    setShowDeleteModal(true);
  };

  // ==========================================================
  // ROUTE TO DEDICATED SEPARATE SECTION PAGES
  // ==========================================================
  if (activeSubPage === 'edit_profile') {
    return <EditProfilePage onBack={() => setActiveSubPage(null)} />;
  }

  if (activeSubPage === 'wallet') {
    return <WalletPage onBack={() => setActiveSubPage(null)} />;
  }

  if (activeSubPage === 'settings') {
    return <SettingsPage onBack={() => setActiveSubPage(null)} />;
  }

  if (activeSubPage === 'app_info') {
    return (
      <AppInfoPage
        onBack={() => setActiveSubPage(null)}
        onOpenPolicy={(policyKey) => setActiveSubPage(policyKey)}
      />
    );
  }

  if (
    activeSubPage === 'terms' ||
    activeSubPage === 'privacy' ||
    activeSubPage === 'referral_policy'
  ) {
    return (
      <LegalPolicyPage
        policyKey={activeSubPage as PolicyKey}
        onBack={() => setActiveSubPage(null)}
      />
    );
  }

  // ==========================================================
  // MAIN PROFILE SCREEN VIEW (NEW UI DESIGN)
  // ==========================================================
  const currentLevel = Math.floor((user.xp ?? 0) / 100) + 1;
  const currentLevelProgress = ((user.xp ?? 0) % 100);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 1. Header: Back Button / Screen Title / Settings Shortcut */}
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
          <View style={styles.headerLeftGroup}>
            <View style={[styles.headerIconBadge, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}>
              <Ionicons name="person" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable
              onPress={() => setActiveSubPage('settings')}
              style={({ pressed }) => [
                styles.headerIconBtn,
                { backgroundColor: colors.cardSecondary, borderColor: colors.border },
                pressed && { opacity: 0.75 },
              ]}
              hitSlop={8}>
              <Ionicons name="settings-outline" size={17} color={colors.text} />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 84 },
        ]}
        showsVerticalScrollIndicator={false}>
        {/* 1. Next-Gen Scholar Identity Card */}
        <AnimatedCard
          index={0}
          onPress={() => setActiveSubPage('edit_profile')}
          style={[
            styles.identityHeroCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}>
          <View style={[styles.heroCardAccent, { backgroundColor: colors.primary }]} />

          <View style={styles.identityHeroBody}>
            {/* Centered Avatar with Camera Indicator */}
            <View style={styles.avatarGlowContainer}>
              <View style={[styles.avatarOuterRing, { borderColor: colors.primary }]}>
                <AvatarIcon avatarId={user.avatar} size={76} />
              </View>
              <View style={[styles.avatarCameraBadge, { backgroundColor: colors.primary, borderColor: colors.card }]}>
                <Ionicons name="camera" size={12} color="#0F172A" />
              </View>
            </View>

            {/* Name & Verified Badge */}
            <View style={styles.nameBadgeRow}>
              <Text style={[styles.heroUserName, { color: colors.text }]} numberOfLines={1}>
                {user.name || user.username}
              </Text>
              <View style={[styles.verifiedPill, { backgroundColor: 'rgba(16, 185, 129, 0.14)' }]}>
                <Ionicons name="shield-checkmark" size={11} color="#10B981" />
                <Text style={styles.verifiedPillText}>VERIFIED</Text>
              </View>
            </View>

            {/* Handle & Email Row */}
            <View style={styles.handleEmailRow}>
              <Text style={[styles.heroUserHandle, { color: colors.primary }]}>@{user.username}</Text>
              <Text style={[styles.handleDivider, { color: colors.textMuted }]}>•</Text>
              <Text style={[styles.heroUserEmail, { color: colors.textSecondary }]} numberOfLines={1}>
                {user.email}
              </Text>
            </View>

            {/* Unified Academic Institution Capsule */}
            <View style={[styles.academicCapsule, { backgroundColor: colors.cardSecondary, borderColor: colors.borderSubtle }]}>
              <Ionicons name="school-outline" size={14} color={colors.primary} />
              <Text style={[styles.academicCapsuleText, { color: colors.text }]} numberOfLines={1}>
                {user.university ? user.university : 'Add University'}
                {user.collegeDepartment ? ` • ${user.collegeDepartment}` : ''}
                {user.semester ? ` • Sem ${user.semester}` : ''}
              </Text>
            </View>

            {/* Edit Profile Action Button */}
            <Pressable
              onPress={() => setActiveSubPage('edit_profile')}
              style={({ pressed }) => [
                styles.heroEditActionBtn,
                { backgroundColor: colors.cardSecondary, borderColor: colors.border },
                pressed && { opacity: 0.75 },
              ]}>
              <Ionicons name="create-outline" size={14} color={colors.primary} />
              <Text style={[styles.heroEditActionBtnText, { color: colors.primary }]}>Edit Profile Details</Text>
            </Pressable>
          </View>
        </AnimatedCard>

        {/* 2. Mastery & Wealth Swipeable Carousel (Single Card in Row) */}
        <View style={styles.carouselHeaderRow}>
          <Text style={[styles.sectionGroupLabel, { color: colors.textMuted, marginBottom: 0 }]}>
            ACADEMIC MASTERY & WEALTH
          </Text>
          <View style={styles.carouselPaginationDots}>
            {[0, 1, 2].map((idx) => (
              <View
                key={idx}
                style={[
                  styles.carouselDot,
                  {
                    width: carouselIndex === idx ? 16 : 5,
                    backgroundColor: carouselIndex === idx ? colors.primary : colors.border,
                  },
                ]}
              />
            ))}
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={CAROUSEL_CARD_WIDTH + CAROUSEL_GAP}
          snapToAlignment="start"
          decelerationRate="fast"
          onScroll={handleCarouselScroll}
          scrollEventThrottle={16}
          contentContainerStyle={styles.carouselContainer}
          style={{ marginBottom: 18 }}>
          {/* Slide 1: Study XP Mastery */}
          <AnimatedCard
            index={1}
            style={[
              styles.carouselCard,
              {
                width: CAROUSEL_CARD_WIDTH,
                marginRight: CAROUSEL_GAP,
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}>
            <View style={[styles.cardAccentLine, { backgroundColor: '#F59E0B' }]} />
            <View style={styles.carouselCardTopRow}>
              <View style={styles.carouselCardIconTitle}>
                <View style={[styles.bentoIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.14)' }]}>
                  <Ionicons name="star" size={18} color="#F59E0B" />
                </View>
                <View>
                  <Text style={[styles.carouselCardTitle, { color: colors.text }]}>Study XP Mastery</Text>
                  <Text style={[styles.carouselCardSubtitle, { color: colors.textMuted }]}>
                    Academic experience milestone
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.levelTagBadge,
                  { backgroundColor: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.25)' },
                ]}>
                <Text style={[styles.levelTagText, { color: '#F59E0B' }]}>Level {currentLevel}</Text>
              </View>
            </View>

            <View style={styles.carouselMetricRow}>
              <Text style={[styles.carouselBigValue, { color: colors.text }]}>{user.xp ?? 0}</Text>
              <Text style={[styles.carouselUnitText, { color: colors.textMuted }]}>TOTAL XP</Text>
            </View>

            {/* Micro Progress Track */}
            <View style={styles.progressTrackWrapper}>
              <View style={[styles.progressTrackBg, { backgroundColor: colors.cardSecondary }]}>
                <View
                  style={[
                    styles.progressTrackFill,
                    { width: `${Math.max(currentLevelProgress, 6)}%`, backgroundColor: '#F59E0B' },
                  ]}
                />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[styles.progressMetaText, { color: colors.textMuted }]}>
                  {currentLevelProgress}/100 XP to Level {currentLevel + 1}
                </Text>
                <Text style={[styles.swipeHintText, { color: colors.textMuted }]}>Swipe ➔</Text>
              </View>
            </View>
          </AnimatedCard>

          {/* Slide 2: Daily Study Streak */}
          <AnimatedCard
            index={2}
            onPress={() => setShowStreakModal(true)}
            style={[
              styles.carouselCard,
              {
                width: CAROUSEL_CARD_WIDTH,
                marginRight: CAROUSEL_GAP,
                backgroundColor: colors.card,
                borderColor: streak.todayCompleted ? 'rgba(255, 90, 60, 0.35)' : colors.border,
              },
            ]}>
            <View style={[styles.cardAccentLine, { backgroundColor: '#FF5A3C' }]} />
            <View style={styles.carouselCardTopRow}>
              <View style={styles.carouselCardIconTitle}>
                <View style={[styles.bentoIconBox, { backgroundColor: 'rgba(255, 90, 60, 0.14)' }]}>
                  <Ionicons name="flame" size={19} color="#FF5A3C" />
                </View>
                <View>
                  <Text style={[styles.carouselCardTitle, { color: colors.text }]}>Daily Study Streak</Text>
                  <Text style={[styles.carouselCardSubtitle, { color: colors.textMuted }]}>
                    Consistency & goal tracker
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.streakStatusDotPill,
                  { backgroundColor: streak.todayCompleted ? 'rgba(16, 185, 129, 0.14)' : 'rgba(255, 90, 60, 0.14)' },
                ]}>
                <Text
                  style={[
                    styles.streakStatusDotText,
                    { color: streak.todayCompleted ? '#10B981' : '#FF5A3C' },
                  ]}>
                  {streak.todayCompleted ? 'Secured Today' : 'Pending Goal'}
                </Text>
              </View>
            </View>

            <View style={styles.carouselMetricRow}>
              <Text style={[styles.carouselBigValue, { color: colors.text }]}>{streak.currentStreak}</Text>
              <Text style={[styles.carouselUnitText, { color: colors.textMuted }]}>DAYS ACTIVE</Text>
            </View>

            <View style={styles.carouselActionFooter}>
              <View style={styles.streakRecordMetaRow}>
                <Ionicons name="trophy-outline" size={13} color="#10B981" />
                <Text style={[styles.streakRecordMetaText, { color: colors.textSecondary }]}>
                  Personal Record: <Text style={{ color: '#10B981', fontWeight: '800' }}>{streak.longestStreak} Days</Text>
                </Text>
              </View>
              <View style={styles.tapActionPill}>
                <Text style={[styles.tapActionPillText, { color: colors.primary }]}>Tap Calendar ➔</Text>
              </View>
            </View>
          </AnimatedCard>

          {/* Slide 3: Axiom Coins & Grant Ledger */}
          <AnimatedCard
            index={3}
            onPress={() => setActiveSubPage('wallet')}
            style={[
              styles.carouselCard,
              {
                width: CAROUSEL_CARD_WIDTH,
                backgroundColor: colors.card,
                borderColor: isDark ? 'rgba(245, 158, 11, 0.35)' : colors.border,
              },
            ]}>
            <View style={[styles.cardAccentLine, { backgroundColor: '#F59E0B' }]} />
            <View style={styles.carouselCardTopRow}>
              <View style={styles.carouselCardIconTitle}>
                <View style={[styles.bentoIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.14)' }]}>
                  <Ionicons name="sparkles" size={18} color="#F59E0B" />
                </View>
                <View>
                  <Text style={[styles.carouselCardTitle, { color: colors.text }]}>Axiom Coins & Wealth</Text>
                  <Text style={[styles.carouselCardSubtitle, { color: colors.textMuted }]}>
                    Academic reward grant balance
                  </Text>
                </View>
              </View>
              <View style={[styles.streakStatusDotPill, { backgroundColor: 'rgba(245, 158, 11, 0.14)' }]}>
                <Text style={[styles.streakStatusDotText, { color: '#F59E0B' }]}>₹{inrBalance} INR</Text>
              </View>
            </View>

            <View style={styles.carouselMetricRow}>
              <Text style={[styles.carouselBigValue, { color: '#F59E0B' }]}>{user.coins ?? 0}</Text>
              <Text style={[styles.carouselUnitText, { color: colors.textMuted }]}>COINS BALANCE</Text>
            </View>

            <View style={styles.carouselActionFooter}>
              <Text style={[styles.streakRecordMetaText, { color: colors.textSecondary }]}>
                Grant Ratio: 100c ≈ ₹1.00
              </Text>
              <View style={styles.tapActionPill}>
                <Text style={[styles.tapActionPillText, { color: '#F59E0B' }]}>Open Wallet ➔</Text>
              </View>
            </View>
          </AnimatedCard>
        </ScrollView>

        {/* 3. Section: Workspace & Preferences */}
        <Text style={[styles.sectionGroupLabel, { color: colors.textMuted }]}>
          WORKSPACE & PREFERENCES
        </Text>
        <View style={[styles.listingContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Item 1: Theme & Storage */}
          <Pressable
            onPress={() => setActiveSubPage('settings')}
            style={({ pressed }) => [
              styles.listingRow,
              { borderBottomColor: colors.borderSubtle },
              pressed && { backgroundColor: colors.cardSecondary },
            ]}>
            <View style={styles.listingRowLeft}>
              <View style={[styles.listIconBox, { backgroundColor: 'rgba(129, 140, 248, 0.12)' }]}>
                <Ionicons name="settings-outline" size={19} color="#818CF8" />
              </View>
              <View>
                <Text style={[styles.listingRowTitle, { color: colors.text }]}>Appearance & Storage</Text>
                <Text style={[styles.listingRowSub, { color: colors.textSecondary }]}>
                  Theme ({themeMode}), offline storage & Hostinger sync
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
          </Pressable>

          {/* Item 2: Check for Updates (OTA) */}
          <Pressable
            onPress={handleCheckUpdates}
            disabled={checkingUpdate}
            style={({ pressed }) => [
              styles.listingRow,
              pressed && { backgroundColor: colors.cardSecondary },
            ]}>
            <View style={styles.listingRowLeft}>
              <View style={[styles.listIconBox, { backgroundColor: 'rgba(56, 189, 248, 0.12)' }]}>
                {checkingUpdate ? (
                  <ActivityIndicator size="small" color="#38BDF8" />
                ) : (
                  <Ionicons name="cloud-download-outline" size={19} color="#38BDF8" />
                )}
              </View>
              <View>
                <Text style={[styles.listingRowTitle, { color: colors.text }]}>Check for Updates</Text>
                <Text style={[styles.listingRowSub, { color: colors.textSecondary }]}>
                  {checkingUpdate
                    ? 'Checking for updates...'
                    : 'Auto-update without reinstalling APK'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* 4. Section: Legal & Policies */}
        <Text style={[styles.sectionGroupLabel, { color: colors.textMuted }]}>
          ABOUT & LEGAL
        </Text>
        <View style={[styles.listingContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* App Info */}
          <Pressable
            onPress={() => setActiveSubPage('app_info')}
            style={({ pressed }) => [
              styles.listingRow,
              { borderBottomColor: colors.borderSubtle },
              pressed && { backgroundColor: colors.cardSecondary },
            ]}>
            <View style={styles.listingRowLeft}>
              <View style={[styles.listIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                <Ionicons name="information-circle-outline" size={19} color="#10B981" />
              </View>
              <View>
                <Text style={[styles.listingRowTitle, { color: colors.text }]}>App Info & Architecture</Text>
                <Text style={[styles.listingRowSub, { color: colors.textSecondary }]}>
                  {appName} v{appVersion} • {packageName}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
          </Pressable>

          {/* Terms & Conditions */}
          <Pressable
            onPress={() => setActiveSubPage('terms')}
            style={({ pressed }) => [
              styles.listingRow,
              { borderBottomColor: colors.borderSubtle },
              pressed && { backgroundColor: colors.cardSecondary },
            ]}>
            <View style={styles.listingRowLeft}>
              <View style={[styles.listIconBox, { backgroundColor: 'rgba(236, 72, 153, 0.12)' }]}>
                <Ionicons name="document-text-outline" size={19} color="#EC4899" />
              </View>
              <View>
                <Text style={[styles.listingRowTitle, { color: colors.text }]}>Terms & Conditions</Text>
                <Text style={[styles.listingRowSub, { color: colors.textSecondary }]}>
                  Platform policies, integrity & usage rules
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
          </Pressable>

          {/* Privacy Policy */}
          <Pressable
            onPress={() => setActiveSubPage('privacy')}
            style={({ pressed }) => [
              styles.listingRow,
              { borderBottomColor: colors.borderSubtle },
              pressed && { backgroundColor: colors.cardSecondary },
            ]}>
            <View style={styles.listingRowLeft}>
              <View style={[styles.listIconBox, { backgroundColor: 'rgba(20, 184, 166, 0.12)' }]}>
                <Ionicons name="shield-checkmark-outline" size={19} color="#14B8A6" />
              </View>
              <View>
                <Text style={[styles.listingRowTitle, { color: colors.text }]}>Privacy Policy</Text>
                <Text style={[styles.listingRowSub, { color: colors.textSecondary }]}>
                  Student data security & zero ad-tracking
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
          </Pressable>

          {/* Referral Policy */}
          <Pressable
            onPress={() => setActiveSubPage('referral_policy')}
            style={({ pressed }) => [
              styles.listingRow,
              pressed && { backgroundColor: colors.cardSecondary },
            ]}>
            <View style={styles.listingRowLeft}>
              <View style={[styles.listIconBox, { backgroundColor: 'rgba(249, 115, 22, 0.12)' }]}>
                <Ionicons name="gift-outline" size={19} color="#F97316" />
              </View>
              <View>
                <Text style={[styles.listingRowTitle, { color: colors.text }]}>Referral & Reward Policy</Text>
                <Text style={[styles.listingRowSub, { color: colors.textSecondary }]}>
                  200 coins per invite & INR redemption rules
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* 5. Section: Account Safety */}
        <Text style={[styles.sectionGroupLabel, { color: colors.textMuted }]}>
          ACCOUNT SECURITY
        </Text>

        {/* Sign Out Button */}
        <Pressable
          onPress={handleConfirmSignOut}
          style={({ pressed }) => [
            styles.signOutBtn,
            {
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.08)',
              borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.25)',
            },
            pressed && { opacity: 0.8 },
          ]}>
          <Ionicons name="log-out-outline" size={18} color={colors.error} />
          <Text style={[styles.signOutBtnText, { color: colors.error }]}>Sign Out of Academic Account</Text>
        </Pressable>

        {/* Delete Account Button */}
        <Pressable
          onPress={handleConfirmDeleteAccount}
          style={({ pressed }) => [
            styles.deleteAccountBtn,
            pressed && { opacity: 0.7 },
          ]}>
          <Ionicons name="trash-bin-outline" size={15} color={colors.textMuted} />
          <Text style={[styles.deleteAccountBtnText, { color: colors.textMuted }]}>
            Delete Account & Academic Records (Right to Erasure)
          </Text>
        </Pressable>
      </ScrollView>

      {/* Streak Modal */}
      <StreakModal visible={showStreakModal} onClose={() => setShowStreakModal(false)} />

      {/* Referral Modal */}
      <ReferralModal visible={showReferralModal} onClose={() => setShowReferralModal(false)} />

      {/* Delete Account Modal */}
      <DeleteAccountModal visible={showDeleteModal} onClose={() => setShowDeleteModal(false)} />
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
  headerIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
  },

  // Next-Gen Identity Hero Card
  identityHeroCard: {
    position: 'relative',
    borderWidth: 1,
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
  },
  heroCardAccent: {
    height: 3.5,
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  identityHeroBody: {
    alignItems: 'center',
    marginTop: 4,
  },
  avatarGlowContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarOuterRing: {
    borderWidth: 2.5,
    borderRadius: 48,
    padding: 3,
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  heroUserName: {
    fontFamily: Fonts.heading,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  verifiedPillText: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 0.6,
  },
  handleEmailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  heroUserHandle: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    fontWeight: '700',
  },
  handleDivider: {
    fontSize: 12,
  },
  heroUserEmail: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
  },
  academicCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    width: '100%',
  },
  academicCapsuleText: {
    fontFamily: Fonts.heading,
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
  heroEditActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    width: '100%',
  },
  heroEditActionBtnText: {
    fontFamily: Fonts.heading,
    fontSize: 13,
    fontWeight: '800',
  },

  // Bento Mastery & Wealth Cards
  sectionGroupLabel: {
    fontFamily: Fonts.headingDemiBold,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  // Carousel Mastery & Wealth Cards
  carouselHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingRight: 4,
  },
  carouselPaginationDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  carouselDot: {
    height: 5,
    borderRadius: 3,
  },
  carouselContainer: {
    paddingHorizontal: 0,
  },
  cardAccentLine: {
    height: 3.5,
    position: 'absolute',
    top: 0,
    left: 18,
    right: 18,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  carouselCard: {
    position: 'relative',
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    minHeight: 180,
    justifyContent: 'space-between',
  },
  carouselCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  carouselCardIconTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  carouselCardTitle: {
    fontFamily: Fonts.heading,
    fontSize: 16,
    fontWeight: '800',
  },
  carouselCardSubtitle: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    marginTop: 1,
  },
  carouselMetricRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 10,
  },
  carouselBigValue: {
    fontFamily: Fonts.heading,
    fontSize: 30,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  carouselUnitText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  swipeHintText: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    fontWeight: '700',
  },
  carouselActionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.18)',
  },
  streakRecordMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  streakRecordMetaText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '600',
  },
  tapActionPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tapActionPillText: {
    fontFamily: Fonts.heading,
    fontSize: 12,
    fontWeight: '800',
  },

  bentoIconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelTagBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  levelTagText: {
    fontFamily: Fonts.mono,
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  progressTrackWrapper: {
    gap: 5,
  },
  progressTrackBg: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressTrackFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressMetaText: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    fontWeight: '600',
  },
  streakStatusDotPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  streakStatusDotText: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    fontWeight: '800',
  },
  listingContainer: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 18,
  },
  listingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  listingRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  listIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listingRowTitle: {
    fontFamily: Fonts.heading,
    fontSize: 15.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  listingRowSub: {
    fontFamily: Fonts.body,
    fontSize: 12,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  signOutBtnText: {
    fontFamily: Fonts.heading,
    fontSize: 14.5,
    fontWeight: '700',
  },
  deleteAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginBottom: 24,
  },
  deleteAccountBtnText: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
  },
});

