import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Share,
  BackHandler,
  ActivityIndicator,
  Linking,
  Animated,
} from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useAlert } from '@/context/AlertContext';
import { StyledAlertButton } from '../StyledAlertModal';
import { AppIcon } from '../AppIcon';
import { Fonts } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/context/ThemeContext';
import { checkAppUpdate, notifyUpdateAvailable } from '@/services/updates';

function AnimatedCard({
  children,
  style,
  index = 0,
}: {
  children: React.ReactNode;
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
        delay: Math.min(index * 45, 260),
        useNativeDriver: true,
      }),
      Animated.spring(translateYAnim, {
        toValue: 0,
        friction: 8,
        tension: 45,
        delay: Math.min(index * 45, 260),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, translateYAnim, index]);

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
}

export function AppInfoPage({
  onBack,
  onOpenPolicy,
}: {
  onBack: () => void;
  onOpenPolicy: (policyKey: 'terms' | 'privacy' | 'referral_policy') => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { showAlert } = useAlert();
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const Alert = {
    alert: (title: string, message?: string, buttons?: StyledAlertButton[]) => {
      showAlert(title, message, buttons);
    },
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const appName = Constants.expoConfig?.name || 'AxiomByte';
  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const appBuildNumber =
    Constants.expoConfig?.android?.versionCode?.toString() ||
    Constants.expoConfig?.ios?.buildNumber ||
    '1';
  const packageName = Constants.expoConfig?.android?.package || 'in.kauxync.axiombyte';
  const bundleId = Constants.expoConfig?.ios?.bundleIdentifier || 'in.kauxync.axiombyte';
  const appScheme = Constants.expoConfig?.scheme || 'axiombyte';

  const handleCopyPackageName = () => {
    Alert.alert(
      'Package Identifier',
      `Application Package: ${packageName}\nBundle ID: ${bundleId}`
    );
  };

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
              <Text style={[styles.headerTitle, { color: colors.text }]}>App Info & Specs</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                Build details, architecture & engineering credits
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
        showsVerticalScrollIndicator={false}>
        {/* Hero Card */}
        <AnimatedCard
          index={0}
          style={[styles.appInfoHero, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View
            style={[
              styles.appLogoCircle,
              { backgroundColor: colors.primaryBg, borderColor: colors.primary },
            ]}>
            <AppIcon size={42} />
          </View>
          <Text style={[styles.appInfoTitle, { color: colors.text }]}>
            {appName.slice(0, 5)}
            <Text style={{ color: colors.primary }}>{appName.slice(5) || 'Byte'}</Text>
          </Text>
          <View style={styles.appHeroPillsRow}>
            <View
              style={[
                styles.versionPill,
                { backgroundColor: colors.cardSecondary, borderColor: colors.border },
              ]}>
              <Text style={[styles.versionPillText, { color: colors.textSecondary }]}>
                v{appVersion} • Build {appBuildNumber}
              </Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
              <View style={styles.statusDot} />
              <Text style={styles.statusPillText}>Production</Text>
            </View>
          </View>
          <Text style={[styles.appInfoDesc, { color: colors.textSecondary }]}>
            Computer Science & Discrete Mathematics learning environment engineered for high-performance offline study.
          </Text>
        </AnimatedCard>

        {/* 1. Application Details */}
        <AnimatedCard
          index={1}
          style={[styles.cardBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeaderWithIcon}>
            <Ionicons name="cube-outline" size={18} color={colors.primary} />
            <Text style={[styles.subSectionTitle, { color: colors.text }]}>Application Details</Text>
          </View>

          {[
            { label: 'App Name', val: appName },
            { label: 'Package Name', val: packageName, copyable: true },
            { label: 'Bundle Identifier', val: bundleId },
            { label: 'Version Name', val: appVersion },
            { label: 'Build Number', val: `${appBuildNumber} (Release)` },
            { label: 'Deep Link Scheme', val: `${appScheme}://` },
            { label: 'Target Platform', val: 'Android / iOS / Web' },
            { label: 'Offline Engine', val: 'Hostinger MySQL Sync + Local Store' },
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
        </AnimatedCard>

        {/* 2. Development & Organization Information */}
        <AnimatedCard
          index={2}
          style={[styles.cardBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
        </AnimatedCard>

        {/* 3. Quick Actions */}
        <AnimatedCard
          index={3}
          style={[styles.cardBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.subSectionTitle, { color: colors.text }]}>Quick Actions</Text>

          <Pressable
            onPress={handleCheckUpdates}
            disabled={checkingUpdate}
            style={({ pressed }) => [
              styles.outlineActionBtn,
              { borderColor: colors.primary, backgroundColor: colors.primaryBg },
              pressed && { opacity: 0.8 },
            ]}>
            {checkingUpdate ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Ionicons name="refresh-circle-outline" size={18} color={colors.primary} />
                <Text style={[styles.outlineActionBtnText, { color: colors.primary }]}>
                  Check for Updates (OTA)
                </Text>
              </>
            )}
          </Pressable>

          <View style={styles.actionBtnGridRow}>
            <Pressable
              onPress={handleOpenWebsite}
              style={({ pressed }) => [
                styles.halfActionBtn,
                { borderColor: colors.border, backgroundColor: colors.cardSecondary },
                pressed && { opacity: 0.75 },
              ]}>
              <Ionicons name="globe-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.halfActionBtnText, { color: colors.text }]}>Website</Text>
            </Pressable>

            <Pressable
              onPress={handleContactSupport}
              style={({ pressed }) => [
                styles.halfActionBtn,
                { borderColor: colors.border, backgroundColor: colors.cardSecondary },
                pressed && { opacity: 0.75 },
              ]}>
              <Ionicons name="mail-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.halfActionBtnText, { color: colors.text }]}>Support</Text>
            </Pressable>

            <Pressable
              onPress={handleShareApp}
              style={({ pressed }) => [
                styles.halfActionBtn,
                { borderColor: colors.border, backgroundColor: colors.cardSecondary },
                pressed && { opacity: 0.75 },
              ]}>
              <Ionicons name="share-social-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.halfActionBtnText, { color: colors.text }]}>Share</Text>
            </Pressable>
          </View>
        </AnimatedCard>

        {/* 4. Policy Navigation Shortcuts */}
        <AnimatedCard
          index={4}
          style={[
            styles.cardBlock,
            { backgroundColor: colors.card, borderColor: colors.border, paddingVertical: 4 },
          ]}>
          <Pressable
            onPress={() => onOpenPolicy('terms')}
            style={({ pressed }) => [
              styles.appInfoNavRow,
              { borderBottomColor: colors.borderSubtle },
              pressed && { opacity: 0.7 },
            ]}>
            <View style={styles.appInfoNavLeft}>
              <Ionicons name="document-text-outline" size={16} color={colors.textMuted} />
              <Text style={[styles.appInfoNavText, { color: colors.text }]}>Terms & Conditions</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>

          <Pressable
            onPress={() => onOpenPolicy('privacy')}
            style={({ pressed }) => [
              styles.appInfoNavRow,
              { borderBottomColor: colors.borderSubtle },
              pressed && { opacity: 0.7 },
            ]}>
            <View style={styles.appInfoNavLeft}>
              <Ionicons name="shield-outline" size={16} color={colors.textMuted} />
              <Text style={[styles.appInfoNavText, { color: colors.text }]}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>

          <Pressable
            onPress={() => onOpenPolicy('referral_policy')}
            style={({ pressed }) => [
              styles.appInfoNavRow,
              pressed && { opacity: 0.7 },
            ]}>
            <View style={styles.appInfoNavLeft}>
              <Ionicons name="gift-outline" size={16} color={colors.textMuted} />
              <Text style={[styles.appInfoNavText, { color: colors.text }]}>Reward & Referral Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        </AnimatedCard>

        {/* Copyright Footer */}
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
  appInfoHero: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  appLogoCircle: {
    width: 68,
    height: 68,
    borderRadius: 22,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  appInfoTitle: {
    fontFamily: Fonts.heading,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
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
  appInfoDesc: {
    fontFamily: Fonts.body,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18.5,
    maxWidth: 290,
  },
  cardBlock: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  cardHeaderWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  subSectionTitle: {
    fontFamily: Fonts.heading,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  specLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11.5,
    flexShrink: 0,
    maxWidth: '48%',
  },
  specVal: {
    fontFamily: Fonts.heading,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  specValueCopyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  specValMono: {
    fontFamily: Fonts.mono,
    fontSize: 12,
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
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  halfActionBtnText: {
    fontFamily: Fonts.heading,
    fontSize: 13,
    fontWeight: '700',
  },
  appInfoNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
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
});

