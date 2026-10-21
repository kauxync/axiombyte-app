import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  TextInput,
  Share,
  BackHandler,
  ActivityIndicator,
  Linking,
} from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { AvatarIcon, AvatarPicker } from './AvatarPicker';
import { StreakModal } from './StreakModal';
import { ReferralModal } from './ReferralModal';
import { Fonts } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/context/ThemeContext';
import { checkServerStatus } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ProfileSubPage =
  | null
  | 'edit_profile'
  | 'wallet'
  | 'settings'
  | 'app_info'
  | 'terms'
  | 'privacy'
  | 'referral_policy';

export function ProfileWalletView({
  onGoBack,
  canGoBack = true,
}: {
  onGoBack?: () => void;
  canGoBack?: boolean;
} = {}) {
  const { user, streak, transactions, updateProfile, simulateFriendReferral, logout, deleteAccount } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors, isDark, themeMode, setThemeMode } = useAppTheme();

  // Active Sub-page State (Listing pages separate for all)
  const [activeSubPage, setActiveSubPage] = useState<ProfileSubPage>(null);

  // Modals
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [checkingServer, setCheckingServer] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Edit Profile Form State
  const [editName, setEditName] = useState(user?.name || '');
  const [editUsername, setEditUsername] = useState(user?.username || '');
  const [editAvatar, setEditAvatar] = useState(user?.avatar || 'avatar_1');
  const [editUniversity, setEditUniversity] = useState(user?.university || '');
  const [editDepartment, setEditDepartment] = useState(user?.collegeDepartment || '');
  const [editSemester, setEditSemester] = useState(user?.semester || '1');
  const [savingProfile, setSavingProfile] = useState(false);

  // Handle hardware Back button: If in a sub-page, return to profile main view
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

  const handleCopyCode = () => {
    setCopiedCode(true);
    Alert.alert('Code Copied!', `Referral code "${user.referralCode}" copied to clipboard.`);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleShareReferral = async () => {
    try {
      await Share.share({
        title: 'Master CS & Math on AxiomByte',
        message: `Join me on AxiomByte! Use my code ${user.referralCode} to get 100 bonus coins on sign-up: https://axiombyte.kauxync.in/`,
      });
    } catch {
      // User cancelled
    }
  };

  const handleTestReferralReward = async () => {
    try {
      const updated = await simulateFriendReferral();
      Alert.alert(
        '🎉 Referral Bonus Credited!',
        `A friend signed up using your code ${user.referralCode}.\n+200 Coins (₹2.00) added!\nNew balance: ${updated} Coins (₹${(updated / 100).toFixed(2)})`
      );
    } catch {
      Alert.alert('Error', 'Could not simulate referral credit.');
    }
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

  const handleClearCache = async () => {
    Alert.alert(
      'Clear Offline Cache',
      'This will clear locally stored curriculum copies. They will be refetched on your next launch.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('@axiombyte_curriculum_cache_v1');
              Alert.alert('Cache Cleared', 'Offline curriculum cache has been reset.');
            } catch {
              Alert.alert('Notice', 'Cache could not be removed.');
            }
          },
        },
      ]
    );
  };

  const appName = Constants.expoConfig?.name || 'AxiomByte';
  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const packageName = Constants.expoConfig?.android?.package || 'in.kauxync.axiombyte';
  const bundleId = Constants.expoConfig?.ios?.bundleIdentifier || 'in.kauxync.axiombyte';
  const appScheme = Constants.expoConfig?.scheme || 'axiombyte';

  const handleCopyPackageName = () => {
    Alert.alert(
      'Package Identifier',
      `Application Package: ${packageName}\nBundle ID: ${bundleId}`
    );
  };

  const handleCheckUpdates = () => {
    Alert.alert(
      'App Up to Date',
      `${appName} v${appVersion} (Build 42) is running the latest production release.`
    );
  };

  const handleOpenWebsite = () => {
    Linking.openURL('https://axiombyte.kauxync.in').catch(() => {
      Alert.alert('Website', 'Visit us online at https://axiombyte.kauxync.in');
    });
  };

  const handleContactSupport = () => {
    Linking.openURL('mailto:support@kauxync.in?subject=AxiomByte%20Support').catch(() => {
      Alert.alert('Customer Support', 'Reach our team directly at support@kauxync.in');
    });
  };

  const handleShareApp = async () => {
    try {
      await Share.share({
        title: `${appName} - Master Computer Science & Mathematics`,
        message: `Learn Computer Science, programming languages, and discrete mathematics with ${appName}! Download: https://axiombyte.kauxync.in`,
      });
    } catch {
      // Ignored
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Missing Name', 'Please enter your full name.');
      return;
    }
    if (!editUsername.trim()) {
      Alert.alert('Missing Username', 'Please enter a valid handle.');
      return;
    }

    setSavingProfile(true);
    try {
      const res = await updateProfile({
        name: editName.trim(),
        username: editUsername.trim().replace(/^@/, ''),
        avatar: editAvatar,
        university: editUniversity.trim(),
        collegeDepartment: editDepartment.trim(),
        semester: editSemester,
      });

      if (res.success) {
        Alert.alert('Profile Updated', 'Your profile details have been saved.');
        setActiveSubPage(null);
      } else {
        Alert.alert('Update Failed', res.error || 'Could not update profile.');
      }
    } catch {
      Alert.alert('Error', 'An unexpected error occurred while saving profile.');
    } finally {
      setSavingProfile(false);
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
    Alert.alert(
      'Delete Account & Data',
      'Are you sure you want to permanently delete your AxiomByte account? All personal profile data, academic progress, streak history, and coin records will be erased completely. This action cannot be undone (GDPR & DPDP Right to Erasure).',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Permanently Delete',
          style: 'destructive',
          onPress: async () => {
            const res = await deleteAccount();
            if (!res.success) {
              Alert.alert('Notice', res.error || 'Could not complete deletion request.');
            }
          },
        },
      ]
    );
  };

  // ==========================================================
  // RENDER SUB-PAGES (Edit Profile, Wallet, Settings, App Info, Policies)
  // ==========================================================

  const renderSubPageHeader = (title: string) => (
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
        <Pressable
          onPress={() => setActiveSubPage(null)}
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
      </View>
    </View>
  );

  if (activeSubPage === 'edit_profile') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {renderSubPageHeader('Edit Profile')}
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 80 },
          ]}
          showsVerticalScrollIndicator={false}>
          {/* Avatar Selector */}
          <View style={[styles.cardBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.subSectionTitle, { color: colors.text }]}>Choose Avatar</Text>
            <AvatarPicker
              selectedId={editAvatar}
              onSelect={setEditAvatar}
              userId={user.id}
            />
          </View>

          {/* Form Fields */}
          <View style={[styles.cardBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.subSectionTitle, { color: colors.text }]}>Personal Details</Text>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>FULL NAME</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.cardSecondary, borderColor: colors.border, color: colors.text }]}
              value={editName}
              onChangeText={setEditName}
              placeholder="e.g. Kaushalendra Kumar"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>USERNAME / HANDLE</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.cardSecondary, borderColor: colors.border, color: colors.text }]}
              value={editUsername}
              onChangeText={setEditUsername}
              placeholder="e.g. kaushalendra"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
            />
          </View>

          {/* Academic Info */}
          <View style={[styles.cardBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.subSectionTitle, { color: colors.text }]}>Academic Information</Text>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>UNIVERSITY / INSTITUTE</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.cardSecondary, borderColor: colors.border, color: colors.text }]}
              value={editUniversity}
              onChangeText={setEditUniversity}
              placeholder="e.g. Delhi Technological University"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>DEPARTMENT / COLLEGE</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.cardSecondary, borderColor: colors.border, color: colors.text }]}
              value={editDepartment}
              onChangeText={setEditDepartment}
              placeholder="e.g. Computer Science & Engineering"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>SEMESTER (1 - 8)</Text>
            <View style={styles.semesterRow}>
              {['1', '2', '3', '4', '5', '6', '7', '8'].map((sem) => {
                const isSelected = editSemester === sem;
                return (
                  <Pressable
                    key={sem}
                    onPress={() => setEditSemester(sem)}
                    style={[
                      styles.semesterChip,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.cardSecondary,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.semesterChipText,
                        { color: isSelected ? '#0F172A' : colors.textSecondary },
                      ]}>
                      {sem}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Save Button */}
          <Pressable
            onPress={handleSaveProfile}
            disabled={savingProfile}
            style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}>
            {savingProfile ? (
              <ActivityIndicator color="#0F172A" size="small" />
            ) : (
              <Text style={styles.primaryActionBtnText}>Save Changes</Text>
            )}
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  if (activeSubPage === 'wallet') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {renderSubPageHeader('Wallet & Referrals')}
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 80 },
          ]}
          showsVerticalScrollIndicator={false}>
          {/* Main Wallet Spotlight Card */}
          <View
            style={[
              styles.walletCard,
              {
                backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
                borderColor: isDark ? 'rgba(245, 158, 11, 0.35)' : 'rgba(217, 119, 6, 0.30)',
              },
            ]}>
            <View style={styles.walletHeader}>
              <View style={styles.walletHeaderLeft}>
                <Text style={styles.walletEmoji}>🪙</Text>
                <View>
                  <Text style={[styles.walletTitle, { color: colors.text }]}>AxiomByte Coin Balance</Text>
                  <Text style={styles.walletRateText}>Academic Reward: 100 Coins ≈ ₹1.00 Grant Value</Text>
                </View>
              </View>
              <View style={styles.coinBadge}>
                <Text style={styles.coinBadgeText}>{user.coins} COINS</Text>
              </View>
            </View>

            <View style={styles.balanceRow}>
              <View>
                <Text style={[styles.balanceSubLabel, { color: colors.textMuted }]}>EQUIVALENT VALUE</Text>
                <Text style={styles.balanceBigText}>₹{inrBalance}</Text>
              </View>
              <Pressable
                onPress={handleShareReferral}
                style={[styles.referralActionBtn, { backgroundColor: '#F59E0B' }]}>
                <Ionicons name="share-social" size={15} color="#0F172A" />
                <Text style={styles.referralActionText}>Share Invite</Text>
              </Pressable>
            </View>

            {/* Test Referral Credit Action — visible in dev builds only */}
            {__DEV__ && (
              <Pressable
                onPress={handleTestReferralReward}
                style={[styles.simulateRewardBtn, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
                <Ionicons name="sparkles" size={14} color="#F59E0B" />
                <Text style={[styles.simulateRewardText, { color: colors.text }]}>
                  Simulate Friend Referral (+200 Coins = ₹2.00)
                </Text>
              </Pressable>
            )}
          </View>

          {/* Referral Code Box */}
          <View style={[styles.cardBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.subSectionTitle, { color: colors.text }]}>Your Invite Code</Text>
            <Text style={[styles.policyParagraph, { color: colors.textSecondary }]}>
              Invite college classmates. When they register with your code, they get 100 bonus coins and you receive 200 coins directly to your wallet.
            </Text>

            <View style={[styles.codeCopyBox, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
              <Text style={[styles.codeBoxValue, { color: colors.primary }]}>{user.referralCode}</Text>
              <Pressable onPress={handleCopyCode} style={[styles.copyBtnPill, { backgroundColor: colors.card }]}>
                <Ionicons name={copiedCode ? 'checkmark' : 'copy-outline'} size={14} color={colors.primary} />
                <Text style={[styles.copyBtnPillText, { color: colors.primary }]}>
                  {copiedCode ? 'Copied' : 'Copy'}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Transaction Ledger */}
          <View style={[styles.cardBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.ledgerHeaderRow}>
              <Text style={[styles.subSectionTitle, { color: colors.text }]}>Transaction History</Text>
              <Text style={[styles.txCountMeta, { color: colors.textMuted }]}>
                {transactions.length} records
              </Text>
            </View>

            {transactions.length === 0 ? (
              <Text style={[styles.emptyLedger, { color: colors.textMuted }]}>
                No transactions yet. Share your code to earn your first coins!
              </Text>
            ) : (
              transactions.map((tx) => (
                <View
                  key={tx.id}
                  style={[
                    styles.ledgerItem,
                    {
                      backgroundColor: colors.cardSecondary,
                      borderColor: colors.borderSubtle,
                    },
                  ]}>
                  <View
                    style={[
                      styles.txIconBadge,
                      {
                        backgroundColor: tx.amount > 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                      },
                    ]}>
                    <Ionicons
                      name={tx.amount > 0 ? 'arrow-down-circle' : 'arrow-up-circle'}
                      size={18}
                      color={tx.amount > 0 ? '#10B981' : colors.error}
                    />
                  </View>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.txDesc, { color: colors.text }]} numberOfLines={2}>
                      {tx.description}
                    </Text>
                    <View style={styles.txMetaRow}>
                      <Ionicons name="time-outline" size={11} color={colors.textMuted} />
                      <Text style={[styles.txTime, { color: colors.textMuted }]}>{tx.timestamp}</Text>
                    </View>
                  </View>
                  <View style={styles.txRightCol}>
                    <Text style={[styles.txAmount, { color: tx.amount > 0 ? '#10B981' : colors.error }]}>
                      {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                    </Text>
                    <Text style={[styles.txInrSmall, { color: colors.textSecondary }]}>
                      ₹{(Math.abs(tx.amount) / 100).toFixed(2)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  if (activeSubPage === 'settings') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {renderSubPageHeader('Settings')}
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 80 },
          ]}
          showsVerticalScrollIndicator={false}>
          {/* Appearance Section */}
          <View style={[styles.cardBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.subSectionTitle, { color: colors.text }]}>Appearance</Text>
            <Text style={[styles.policyParagraph, { color: colors.textSecondary }]}>
              Choose your preferred visual theme across all roadmaps and Code Lab environments.
            </Text>

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
                    style={[
                      styles.themeCardBtn,
                      {
                        backgroundColor: isSelected ? colors.primaryBg : colors.cardSecondary,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
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
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Storage & Data Section */}
          <View style={[styles.cardBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.subSectionTitle, { color: colors.text }]}>Storage & Offline Cache</Text>
            <Text style={[styles.policyParagraph, { color: colors.textSecondary }]}>
              AxiomByte caches all roadmaps, code lessons, and math formulas offline on your device for instant launch.
            </Text>

            <Pressable
              onPress={handleClearCache}
              style={[styles.outlineActionBtn, { borderColor: colors.border, backgroundColor: colors.cardSecondary }]}>
              <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.outlineActionBtnText, { color: colors.text }]}>
                Clear Local Curriculum Cache
              </Text>
            </Pressable>
          </View>

          {/* Server Connectivity Section */}
          <View style={[styles.cardBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.subSectionTitle, { color: colors.text }]}>Cloud Backend</Text>
            <Text style={[styles.policyParagraph, { color: colors.textSecondary }]}>
              Hostinger MySQL cloud server sync status.
            </Text>

            <Pressable
              onPress={handleCheckHostingerServer}
              disabled={checkingServer}
              style={[styles.outlineActionBtn, { borderColor: colors.border, backgroundColor: colors.cardSecondary }]}>
              {checkingServer ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="server-outline" size={16} color="#10B981" />
                  <Text style={[styles.outlineActionBtnText, { color: colors.text }]}>
                    Check Server Connection
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (activeSubPage === 'app_info') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {renderSubPageHeader('App Info')}
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 80 },
          ]}
          showsVerticalScrollIndicator={false}>
          {/* Logo & Version Hero */}
          <View style={[styles.appInfoHero, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.appLogoCircle, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}>
              <Ionicons name="terminal" size={36} color={colors.primary} />
            </View>
            <Text style={[styles.appInfoTitle, { color: colors.text }]}>
              {appName.slice(0, 5)}<Text style={{ color: colors.primary }}>{appName.slice(5) || 'Byte'}</Text>
            </Text>
            <View style={styles.appHeroPillsRow}>
              <View style={[styles.versionPill, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
                <Text style={[styles.versionPillText, { color: colors.textSecondary }]}>v{appVersion} • Build 42</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                <View style={styles.statusDot} />
                <Text style={styles.statusPillText}>Production</Text>
              </View>
            </View>
            <Text style={[styles.appInfoDesc, { color: colors.textSecondary }]}>
              Computer Science & Discrete Mathematics learning environment engineered for high-performance offline study.
            </Text>
          </View>

          {/* 1. Application Details */}
          <View style={[styles.cardBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeaderWithIcon}>
              <Ionicons name="cube-outline" size={18} color={colors.primary} />
              <Text style={[styles.subSectionTitle, { color: colors.text }]}>Application Details</Text>
            </View>

            {[
              { label: 'App Name', val: appName },
              { label: 'Package Name', val: packageName, copyable: true },
              { label: 'Bundle Identifier', val: bundleId },
              { label: 'Version Name', val: appVersion },
              { label: 'Build Number', val: '42 (Release)' },
              { label: 'Deep Link Scheme', val: `${appScheme}://` },
              { label: 'Target Platform', val: 'Android / iOS / Web' },
              { label: 'Category', val: 'Education & Engineering' },
            ].map((spec, sIdx) => (
              <View key={sIdx} style={[styles.specRow, { borderBottomColor: colors.borderSubtle }]}>
                <Text style={[styles.specLabel, { color: colors.textMuted }]}>{spec.label}</Text>
                {spec.copyable ? (
                  <Pressable onPress={handleCopyPackageName} style={styles.specValueCopyRow}>
                    <Text style={[styles.specValMono, { color: colors.primary }]}>{spec.val}</Text>
                    <Ionicons name="copy-outline" size={13} color={colors.primary} />
                  </Pressable>
                ) : (
                  <Text style={[styles.specVal, { color: colors.text }]}>{spec.val}</Text>
                )}
              </View>
            ))}
          </View>

          {/* 2. Development & Organization Information */}
          <View style={[styles.cardBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeaderWithIcon}>
              <Ionicons name="business-outline" size={18} color="#818CF8" />
              <Text style={[styles.subSectionTitle, { color: colors.text }]}>Developer & Organization</Text>
            </View>

            {[
              { label: 'Developed By', val: 'Kauxync Technologies' },
              { label: 'Lead Developer', val: 'Kaushalendra Kumar' },
              { label: 'Organization', val: 'Kauxync Inc.' },
              { label: 'Official Website', val: 'axiombyte.kauxync.in', isLink: true, action: handleOpenWebsite },
              { label: 'Support Email', val: 'support@kauxync.in', isLink: true, action: handleContactSupport },
              { label: 'Origin Country', val: 'India 🇮🇳' },
            ].map((item, idx) => (
              <View key={idx} style={[styles.specRow, { borderBottomColor: colors.borderSubtle }]}>
                <Text style={[styles.specLabel, { color: colors.textMuted }]}>{item.label}</Text>
                {item.isLink ? (
                  <Pressable onPress={item.action} style={styles.specValueLinkRow}>
                    <Text style={[styles.specValLink, { color: colors.primary }]}>{item.val}</Text>
                    <Ionicons name="open-outline" size={13} color={colors.primary} />
                  </Pressable>
                ) : (
                  <Text style={[styles.specVal, { color: colors.text }]}>{item.val}</Text>
                )}
              </View>
            ))}
          </View>

          {/* 3. System Capabilities & Data Engine */}
          <View style={[styles.cardBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeaderWithIcon}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#10B981" />
              <Text style={[styles.subSectionTitle, { color: colors.text }]}>Permissions & Privacy</Text>
            </View>

            {[
              { label: 'Storage Engine', val: 'SecureStore (Keystore/Keychain) & Offline Cache' },
              { label: 'Curriculum Cache', val: 'Complete Offline Delivery' },
              { label: 'Cloud Backend', val: 'Hostinger Cloud API Sync' },
              { label: 'User Privacy', val: 'Privacy-Preserving (Zero Third-Party Ads)' },
              { label: 'Runtime Engine', val: 'React Native 0.88 / Hermes' },
            ].map((item, idx) => (
              <View key={idx} style={[styles.specRow, { borderBottomColor: colors.borderSubtle }]}>
                <Text style={[styles.specLabel, { color: colors.textMuted }]}>{item.label}</Text>
                <Text style={[styles.specVal, { color: colors.text }]}>{item.val}</Text>
              </View>
            ))}
          </View>

          {/* 4. Quick Actions */}
          <View style={[styles.cardBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.subSectionTitle, { color: colors.text }]}>Quick Actions</Text>

            <Pressable
              onPress={handleCheckUpdates}
              style={[styles.outlineActionBtn, { borderColor: colors.primary, backgroundColor: colors.primaryBg }]}>
              <Ionicons name="refresh-circle-outline" size={18} color={colors.primary} />
              <Text style={[styles.outlineActionBtnText, { color: colors.primary }]}>
                Check for Updates
              </Text>
            </Pressable>

            <View style={styles.actionBtnGridRow}>
              <Pressable
                onPress={handleOpenWebsite}
                style={[styles.halfActionBtn, { borderColor: colors.border, backgroundColor: colors.cardSecondary }]}>
                <Ionicons name="globe-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.halfActionBtnText, { color: colors.text }]}>Website</Text>
              </Pressable>

              <Pressable
                onPress={handleContactSupport}
                style={[styles.halfActionBtn, { borderColor: colors.border, backgroundColor: colors.cardSecondary }]}>
                <Ionicons name="mail-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.halfActionBtnText, { color: colors.text }]}>Support</Text>
              </Pressable>

              <Pressable
                onPress={handleShareApp}
                style={[styles.halfActionBtn, { borderColor: colors.border, backgroundColor: colors.cardSecondary }]}>
                <Ionicons name="share-social-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.halfActionBtnText, { color: colors.text }]}>Share</Text>
              </Pressable>
            </View>
          </View>

          {/* 5. Policy Navigation Shortcuts */}
          <View style={[styles.cardBlock, { backgroundColor: colors.card, borderColor: colors.border, paddingVertical: 4 }]}>
            <Pressable
              onPress={() => setActiveSubPage('terms')}
              style={[styles.appInfoNavRow, { borderBottomColor: colors.borderSubtle }]}>
              <View style={styles.appInfoNavLeft}>
                <Ionicons name="document-text-outline" size={16} color={colors.textMuted} />
                <Text style={[styles.appInfoNavText, { color: colors.text }]}>Terms & Conditions</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>

            <Pressable
              onPress={() => setActiveSubPage('privacy')}
              style={[styles.appInfoNavRow, { borderBottomColor: colors.borderSubtle }]}>
              <View style={styles.appInfoNavLeft}>
                <Ionicons name="shield-outline" size={16} color={colors.textMuted} />
                <Text style={[styles.appInfoNavText, { color: colors.text }]}>Privacy Policy</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>

            <Pressable
              onPress={() => setActiveSubPage('referral_policy')}
              style={styles.appInfoNavRow}>
              <View style={styles.appInfoNavLeft}>
                <Ionicons name="gift-outline" size={16} color={colors.textMuted} />
                <Text style={[styles.appInfoNavText, { color: colors.text }]}>Reward & Referral Policy</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Copyright & Engineering Badge */}
          <View style={styles.appInfoFooter}>
            <Text style={[styles.appInfoFooterCopy, { color: colors.textMuted }]}>
              © 2026 Kauxync Technologies. All rights reserved.
            </Text>
            <Text style={[styles.appInfoFooterSub, { color: colors.textMuted }]}>
              Engineered with ❤️ for Computer Science & Mathematics Students
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (activeSubPage === 'terms') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {renderSubPageHeader('Terms & Conditions')}
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 80 },
          ]}
          showsVerticalScrollIndicator={false}>
          <View style={[styles.cardBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.policyHeading, { color: colors.text }]}>1. Acceptance of Terms</Text>
            <Text style={[styles.policyParagraph, { color: colors.textSecondary }]}>
              By creating an account or accessing AxiomByte, you agree to comply with and be bound by these Terms and Conditions. AxiomByte is an educational platform designed for students mastering systems programming, computer science, and discrete mathematics.
            </Text>

            <Text style={[styles.policyHeading, { color: colors.text }]}>2. Academic Integrity</Text>
            <Text style={[styles.policyParagraph, { color: colors.textSecondary }]}>
              All course material, code simulations, and mathematical invariants are provided for educational and pedagogical purposes. Users agree not to utilize automated bots or exploit platform simulation engines.
            </Text>

            <Text style={[styles.policyHeading, { color: colors.text }]}>3. Coin & Referral Program</Text>
            <Text style={[styles.policyParagraph, { color: colors.textSecondary }]}>
              Coins earned through learning streaks, practice modules, and peer invitations are non-transferable outside of authorized platform reward tiers. AxiomByte reserves the right to void coin balances obtained through fraudulent accounts or emulator scripting.
            </Text>

            <Text style={[styles.policyHeading, { color: colors.text }]}>4. Intellectual Property</Text>
            <Text style={[styles.policyParagraph, { color: colors.textSecondary }]}>
              All visual execution steppers, mathematical formulas, and custom interactive curricula are intellectual property of Kauxync Technologies.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (activeSubPage === 'privacy') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {renderSubPageHeader('Privacy Policy')}
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 80 },
          ]}
          showsVerticalScrollIndicator={false}>
          <View style={[styles.cardBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.policyHeading, { color: colors.text }]}>1. Offline-First Privacy</Text>
            <Text style={[styles.policyParagraph, { color: colors.textSecondary }]}>
              AxiomByte operates on an offline-first architectural model. Your learning activity, code simulation steps, and progress logs are stored locally on your device whenever offline.
            </Text>

            <Text style={[styles.policyHeading, { color: colors.text }]}>2. Data Synchronization</Text>
            <Text style={[styles.policyParagraph, { color: colors.textSecondary }]}>
              When connected to the internet, basic profile information (name, university, department, semester, and coin wallet balance) synchronizes securely with our Hostinger MySQL server over HTTPS/TLS encryption.
            </Text>

            <Text style={[styles.policyHeading, { color: colors.text }]}>3. Zero Advertising Tracking</Text>
            <Text style={[styles.policyParagraph, { color: colors.textSecondary }]}>
              We do not sell, rent, or share student personal data with third-party advertisers or data brokers.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (activeSubPage === 'referral_policy') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {renderSubPageHeader('Referral & Reward Policy')}
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 80 },
          ]}
          showsVerticalScrollIndicator={false}>
          <View style={[styles.cardBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.policyHeading, { color: colors.text }]}>1. Earning Rules</Text>
            <Text style={[styles.policyParagraph, { color: colors.textSecondary }]}>
              Every verified university student receives a unique referral code. When a new peer joins using your code, you receive 200 Coins (₹2.00 INR) and the joining student receives 100 Welcome Coins (₹1.00 INR).
            </Text>

            <Text style={[styles.policyHeading, { color: colors.text }]}>2. Currency Valuation</Text>
            <Text style={[styles.policyParagraph, { color: colors.textSecondary }]}>
              AxiomByte Coins maintain a fixed baseline valuation of 100 Coins = ₹1.00 INR.
            </Text>

            <Text style={[styles.policyHeading, { color: colors.text }]}>3. Anti-Fraud Protections</Text>
            <Text style={[styles.policyParagraph, { color: colors.textSecondary }]}>
              Self-referrals, disposable email addresses, and automated script registrations are filtered by server-side verification and will result in referral disqualification.
            </Text>

            <Text style={[styles.policyHeading, { color: colors.text }]}>4. Regulatory Compliance & RBI PPI Exemption</Text>
            <Text style={[styles.policyParagraph, { color: colors.textSecondary }]}>
              AxiomByte Coins constitute closed-loop promotional reward points designed exclusively for academic motivation. Pursuant to Reserve Bank of India (RBI) guidelines on Prepaid Payment Instruments (PPI Master Direction DPSS.CO.PD.No.1164/02.14.006/2017-18), coins are non-negotiable, non-transferable, and cannot be redeemed for fiat cash withdrawals without statutory identity verification and authorized educational grant partner disbursement.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ==========================================================
  // MAIN PROFILE SCREEN VIEW
  // ==========================================================
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 1. Header: Back button and Profile */}
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 84 },
        ]}
        showsVerticalScrollIndicator={false}>
        {/* 2. Profile Container: Avatar, Name, Username, Email, University, Department, Semester */}
        <View
          style={[
            styles.profileCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}>
          <View style={styles.profileTopRow}>
            <View style={[styles.avatarCircleWrapper, { borderColor: colors.border }]}>
              <AvatarIcon avatarId={user.avatar} size={64} />
            </View>

            <View style={styles.profileInfoCol}>
              <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                {user.name || user.username}
              </Text>
              <Text style={[styles.userHandle, { color: colors.primary }]}>@{user.username}</Text>
              <View style={[styles.emailBadge, { backgroundColor: colors.cardSecondary }]}>
                <Ionicons name="mail-outline" size={12} color={colors.textMuted} />
                <Text style={[styles.emailText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {user.email}
                </Text>
              </View>
            </View>
          </View>

          {/* Academic Metadata Grid */}
          <View style={[styles.metaGrid, { borderTopColor: colors.border }]}>
            <View style={styles.metaCol}>
              <Text style={[styles.metaLabel, { color: colors.textMuted }]}>UNIVERSITY</Text>
              <Text style={[styles.metaVal, { color: colors.text }]} numberOfLines={1}>
                {user.university || 'Not set'}
              </Text>
            </View>

            <View style={styles.metaCol}>
              <Text style={[styles.metaLabel, { color: colors.textMuted }]}>DEPARTMENT/CLG</Text>
              <Text style={[styles.metaVal, { color: colors.text }]} numberOfLines={1}>
                {user.collegeDepartment || 'Not set'}
              </Text>
            </View>

            <View style={styles.metaColNarrow}>
              <Text style={[styles.metaLabel, { color: colors.textMuted }]}>SEMESTER</Text>
              <Text style={[styles.metaVal, { color: colors.primary }]}>
                {user.semester ? `Sem ${user.semester}` : 'Not set'}
              </Text>
            </View>
          </View>
        </View>

        {/* 3. Streak Container Perfect */}
        <Pressable
          onPress={() => setShowStreakModal(true)}
          style={({ pressed }) => [
            styles.streakSummaryCard,
            {
              backgroundColor: colors.card,
              borderColor: streak.todayCompleted
                ? 'rgba(255, 90, 60, 0.35)'
                : colors.border,
            },
            pressed && { opacity: 0.85 },
          ]}>
          <View style={styles.streakSummaryLeft}>
            <View
              style={[
                styles.streakIconCircle,
                {
                  backgroundColor: streak.todayCompleted
                    ? 'rgba(255, 90, 60, 0.16)'
                    : 'rgba(245, 158, 11, 0.16)',
                },
              ]}>
              <Text style={styles.streakEmojiText}>🔥</Text>
            </View>

            <View style={styles.streakSummaryTextCol}>
              <View style={styles.streakTitleBadgeRow}>
                <Text style={[styles.streakCardTitle, { color: colors.text }]}>
                  {streak.currentStreak} Day Learning Streak
                </Text>
                <View
                  style={[
                    styles.streakStatusBadge,
                    {
                      backgroundColor: streak.lostStreak && streak.lostStreak > 0
                        ? 'rgba(239, 68, 68, 0.14)'
                        : streak.todayCompleted
                        ? 'rgba(16, 185, 129, 0.14)'
                        : 'rgba(245, 158, 11, 0.14)',
                    },
                  ]}>
                  <Text
                    style={[
                      styles.streakStatusBadgeText,
                      {
                        color: streak.lostStreak && streak.lostStreak > 0
                          ? '#EF4444'
                          : streak.todayCompleted
                          ? '#10B981'
                          : '#F59E0B',
                      },
                    ]}>
                    {streak.lostStreak && streak.lostStreak > 0
                      ? 'RECOVERABLE'
                      : streak.todayCompleted
                      ? 'COMPLETED'
                      : 'PENDING'}
                  </Text>
                </View>
              </View>

              <Text
                style={[
                  styles.streakCardSub,
                  {
                    color: streak.lostStreak && streak.lostStreak > 0
                      ? '#EF4444'
                      : colors.textMuted,
                  },
                ]}>
                {streak.lostStreak && streak.lostStreak > 0
                  ? `💔 ${streak.lostStreak} days lost • Tap to restore with Freeze`
                  : `Record: ${streak.longestStreak} days • ${streak.freezeCount} Shield available`}
              </Text>
            </View>
          </View>

          <View style={styles.streakChevronCol}>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </View>
        </Pressable>

        {/* 4. Listing Pages (Separate sub-pages for all of them) */}
        <View style={[styles.listingContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Item 1: Edit Profile */}
          <Pressable
            onPress={() => setActiveSubPage('edit_profile')}
            style={({ pressed }) => [
              styles.listingRow,
              { borderBottomColor: colors.borderSubtle },
              pressed && { backgroundColor: colors.cardSecondary },
            ]}>
            <View style={styles.listingRowLeft}>
              <View style={[styles.listIconBox, { backgroundColor: 'rgba(56, 189, 248, 0.12)' }]}>
                <Ionicons name="person-circle-outline" size={20} color="#38BDF8" />
              </View>
              <View>
                <Text style={[styles.listingRowTitle, { color: colors.text }]}>Edit Profile</Text>
                <Text style={[styles.listingRowSub, { color: colors.textSecondary }]}>
                  Name, avatar, university & semester
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
          </Pressable>

          {/* Item 2: Wallet */}
          <Pressable
            onPress={() => setActiveSubPage('wallet')}
            style={({ pressed }) => [
              styles.listingRow,
              { borderBottomColor: colors.borderSubtle },
              pressed && { backgroundColor: colors.cardSecondary },
            ]}>
            <View style={styles.listingRowLeft}>
              <View style={[styles.listIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                <Ionicons name="wallet-outline" size={20} color="#F59E0B" />
              </View>
              <View>
                <Text style={[styles.listingRowTitle, { color: colors.text }]}>Wallet & Coins</Text>
                <Text style={[styles.listingRowSub, { color: colors.textSecondary }]}>
                  {user.coins} Coins (₹{inrBalance}) • Referrals & ledger
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
          </Pressable>

          {/* Item 3: Settings */}
          <Pressable
            onPress={() => setActiveSubPage('settings')}
            style={({ pressed }) => [
              styles.listingRow,
              { borderBottomColor: colors.borderSubtle },
              pressed && { backgroundColor: colors.cardSecondary },
            ]}>
            <View style={styles.listingRowLeft}>
              <View style={[styles.listIconBox, { backgroundColor: 'rgba(129, 140, 248, 0.12)' }]}>
                <Ionicons name="settings-outline" size={20} color="#818CF8" />
              </View>
              <View>
                <Text style={[styles.listingRowTitle, { color: colors.text }]}>Settings</Text>
                <Text style={[styles.listingRowSub, { color: colors.textSecondary }]}>
                  Theme appearance, offline storage & sync
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
          </Pressable>

          {/* Item 4: App Info */}
          <Pressable
            onPress={() => setActiveSubPage('app_info')}
            style={({ pressed }) => [
              styles.listingRow,
              { borderBottomColor: colors.borderSubtle },
              pressed && { backgroundColor: colors.cardSecondary },
            ]}>
            <View style={styles.listingRowLeft}>
              <View style={[styles.listIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                <Ionicons name="information-circle-outline" size={20} color="#10B981" />
              </View>
              <View>
                <Text style={[styles.listingRowTitle, { color: colors.text }]}>App Info</Text>
                <Text style={[styles.listingRowSub, { color: colors.textSecondary }]}>
                  {appName} v{appVersion} • {packageName}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
          </Pressable>

          {/* Item 5: Terms & Conditions */}
          <Pressable
            onPress={() => setActiveSubPage('terms')}
            style={({ pressed }) => [
              styles.listingRow,
              { borderBottomColor: colors.borderSubtle },
              pressed && { backgroundColor: colors.cardSecondary },
            ]}>
            <View style={styles.listingRowLeft}>
              <View style={[styles.listIconBox, { backgroundColor: 'rgba(236, 72, 153, 0.12)' }]}>
                <Ionicons name="document-text-outline" size={20} color="#EC4899" />
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

          {/* Item 6: Privacy Policy */}
          <Pressable
            onPress={() => setActiveSubPage('privacy')}
            style={({ pressed }) => [
              styles.listingRow,
              { borderBottomColor: colors.borderSubtle },
              pressed && { backgroundColor: colors.cardSecondary },
            ]}>
            <View style={styles.listingRowLeft}>
              <View style={[styles.listIconBox, { backgroundColor: 'rgba(20, 184, 166, 0.12)' }]}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#14B8A6" />
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

          {/* Item 7: Referral & Reward Policy */}
          <Pressable
            onPress={() => setActiveSubPage('referral_policy')}
            style={({ pressed }) => [
              styles.listingRow,
              pressed && { backgroundColor: colors.cardSecondary },
            ]}>
            <View style={styles.listingRowLeft}>
              <View style={[styles.listIconBox, { backgroundColor: 'rgba(249, 115, 22, 0.12)' }]}>
                <Ionicons name="gift-outline" size={20} color="#F97316" />
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

        {/* 5. Sign Out Button */}
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
          <Text style={[styles.signOutBtnText, { color: colors.error }]}>Sign Out</Text>
        </Pressable>

        {/* 6. Delete Account Button (GDPR / DPDP Right to Erasure) */}
        <Pressable
          onPress={handleConfirmDeleteAccount}
          style={({ pressed }) => [
            styles.deleteAccountBtn,
            pressed && { opacity: 0.7 },
          ]}>
          <Ionicons name="trash-bin-outline" size={15} color={colors.textMuted} />
          <Text style={[styles.deleteAccountBtnText, { color: colors.textMuted }]}>
            Delete Account & Personal Data
          </Text>
        </Pressable>
      </ScrollView>

      {/* Streak Modal */}
      <StreakModal visible={showStreakModal} onClose={() => setShowStreakModal(false)} />

      {/* Referral Modal */}
      <ReferralModal visible={showReferralModal} onClose={() => setShowReferralModal(false)} />
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
  headerTitle: {
    fontFamily: Fonts.heading,
    fontSize: 23,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
  },

  // Profile Card
  profileCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  avatarCircleWrapper: {
    borderWidth: 2,
    borderRadius: 36,
    padding: 2,
  },
  profileInfoCol: {
    flex: 1,
  },
  userName: {
    fontFamily: Fonts.heading,
    fontSize: 19,
    fontWeight: '700',
  },
  userHandle: {
    fontFamily: Fonts.mono,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  emailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  emailText: {
    fontFamily: Fonts.body,
    fontSize: 12,
  },

  // Academic Metadata Grid
  metaGrid: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 14,
    gap: 8,
  },
  metaCol: {
    flex: 1,
  },
  metaColNarrow: {
    width: 72,
  },
  metaLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  metaVal: {
    fontFamily: Fonts.heading,
    fontSize: 13.5,
    fontWeight: '600',
  },

  // Streak Summary Card
  streakSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  streakSummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  streakIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakEmojiText: {
    fontSize: 23,
  },
  streakSummaryTextCol: {
    flex: 1,
  },
  streakTitleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  streakCardTitle: {
    fontFamily: Fonts.heading,
    fontSize: 15.5,
    fontWeight: '700',
  },
  streakStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  streakStatusBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  streakCardSub: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
  },
  streakChevronCol: {
    paddingLeft: 4,
  },

  // Listing Container
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
    fontSize: 12.5,
  },

  // Sign Out Button
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
    fontSize: 15,
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
    fontSize: 13,
  },

  // Sub-page Common Styles
  cardBlock: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  subSectionTitle: {
    fontFamily: Fonts.heading,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 10,
  },
  inputLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 10,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: Fonts.body,
    fontSize: 14.5,
  },
  semesterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  semesterChip: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  semesterChipText: {
    fontFamily: Fonts.heading,
    fontSize: 14,
    fontWeight: '700',
  },
  primaryActionBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  primaryActionBtnText: {
    fontFamily: Fonts.heading,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },

  // Wallet Specific
  walletCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },
  walletHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  walletHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  walletEmoji: {
    fontSize: 27,
  },
  walletTitle: {
    fontFamily: Fonts.heading,
    fontSize: 16,
    fontWeight: '700',
  },
  walletRateText: {
    fontFamily: Fonts.mono,
    fontSize: 11.5,
    color: '#F59E0B',
    fontWeight: '600',
  },
  coinBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  coinBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '800',
    color: '#F59E0B',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  balanceSubLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  balanceBigText: {
    fontFamily: Fonts.heading,
    fontSize: 29,
    fontWeight: '800',
    color: '#F59E0B',
  },
  referralActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  referralActionText: {
    fontFamily: Fonts.heading,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  simulateRewardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  simulateRewardText: {
    fontFamily: Fonts.mono,
    fontSize: 12.5,
    fontWeight: '600',
  },
  codeCopyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 8,
  },
  codeBoxValue: {
    fontFamily: Fonts.mono,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  copyBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  copyBtnPillText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
  },
  ledgerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  txCountMeta: {
    fontFamily: Fonts.mono,
    fontSize: 11,
  },
  emptyLedger: {
    fontFamily: Fonts.body,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
  },
  ledgerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  txIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  txDesc: {
    fontFamily: Fonts.heading,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  txMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  txTime: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
  },
  txRightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
    minWidth: 65,
  },
  txAmount: {
    fontFamily: Fonts.mono,
    fontSize: 14.5,
    fontWeight: '800',
  },
  txInrSmall: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },

  // Settings & Theme
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
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
  },
  themeCardBtnText: {
    fontFamily: Fonts.heading,
    fontSize: 14,
    fontWeight: '700',
  },
  outlineActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 11,
    marginTop: 4,
  },
  outlineActionBtnText: {
    fontFamily: Fonts.heading,
    fontSize: 14,
    fontWeight: '600',
  },

  // App Info Hero
  appInfoHero: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  appLogoCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  appInfoTitle: {
    fontFamily: Fonts.heading,
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  appInfoVersion: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
    marginBottom: 8,
  },
  appInfoDesc: {
    fontFamily: Fonts.body,
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 19,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  specLabel: {
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
  specVal: {
    fontFamily: Fonts.heading,
    fontSize: 13,
    fontWeight: '600',
  },
  appHeroPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    marginBottom: 8,
  },
  versionPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  versionPillText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  statusPillText: {
    fontFamily: Fonts.heading,
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
  cardHeaderWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  specValueCopyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  specValMono: {
    fontFamily: Fonts.mono,
    fontSize: 12.5,
    fontWeight: '700',
  },
  specValueLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  specValLink: {
    fontFamily: Fonts.heading,
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  actionBtnGridRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  halfActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  halfActionBtnText: {
    fontFamily: Fonts.heading,
    fontSize: 13,
    fontWeight: '600',
  },
  appInfoNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  appInfoNavLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  appInfoNavText: {
    fontFamily: Fonts.heading,
    fontSize: 14,
    fontWeight: '600',
  },
  appInfoFooter: {
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 10,
    gap: 4,
  },
  appInfoFooterCopy: {
    fontFamily: Fonts.mono,
    fontSize: 11.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  appInfoFooterSub: {
    fontFamily: Fonts.body,
    fontSize: 12,
    textAlign: 'center',
  },

  // Policies
  policyHeading: {
    fontFamily: Fonts.heading,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 4,
  },
  policyParagraph: {
    fontFamily: Fonts.body,
    fontSize: 13.5,
    lineHeight: 19,
    marginBottom: 8,
  },
});
