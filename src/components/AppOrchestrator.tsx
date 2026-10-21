import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { OnboardingView } from './OnboardingView';
import { LoginView } from './LoginView';
import { CompleteProfileView } from './CompleteProfileView';
import { MainAppLayout } from './MainAppLayout';

import { Fonts } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/context/ThemeContext';

export function AppOrchestrator() {
  const { isLoading, isOnboarded, isAuthenticated, isProfileComplete } = useAuth();
  const { colors, isDark } = useAppTheme();
  const [showSplash, setShowSplash] = useState(true);
  const insets = useSafeAreaInsets();

  // Keep branded splash visible for at least 1.5s for polished presentation
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading || showSplash) {
    return (
      <View
        style={[
          styles.splashContainer,
          {
            backgroundColor: colors.background,
            paddingTop: Math.max(insets.top, 24) + 16,
            paddingBottom: Math.max(insets.bottom, 24) + 12,
          },
        ]}>
        <View style={styles.splashContent}>
          {/* Top domain pill */}
          <View
            style={[
              styles.domainBadge,
              {
                backgroundColor: colors.primaryBg,
                borderColor: `${colors.primary}40`,
              },
            ]}>
            <Ionicons name="sparkles" size={12} color={colors.primary} />
            <Text style={[styles.domainBadgeText, { color: colors.primary }]}>
              SYSTEMS COMPUTATION & FORMAL LOGIC
            </Text>
          </View>

          {/* Logo Icon Ring */}
          <View
            style={[
              styles.logoCircle,
              {
                backgroundColor: colors.card,
                borderColor: isDark ? 'rgba(56, 189, 248, 0.35)' : 'rgba(2, 132, 199, 0.30)',
              },
            ]}>
            <Ionicons name="terminal" size={44} color={colors.primary} />
          </View>

          {/* Upgraded Font Style, Size & Family for Heading */}
          <Text style={[styles.splashBrand, { color: colors.text }]}>
            Axiom<Text style={[styles.splashBrandAccent, { color: colors.primary }]}>Byte</Text>
          </Text>

          {/* Upgraded Subtitle Font */}
          <Text style={[styles.splashTagline, { color: colors.textSecondary }]}>
            Computer Science & Discrete Mathematics
          </Text>

          {/* Loading Indicator Pill */}
          <View
            style={[
              styles.loadingBox,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Initializing Local Runtime & Memory Engine...
            </Text>
          </View>
        </View>

        <View style={styles.splashFooter}>
          <Text style={[styles.footerVersion, { color: colors.textMuted }]}>
            v1.0.0 • Offline-First Native Engine
          </Text>
        </View>
      </View>
    );
  }

  // 1. If user hasn't seen onboarding, show the 4-slide onboarding
  if (!isOnboarded) {
    return <OnboardingView onFinish={() => {}} />;
  }

  // 2. If user is not authenticated, show Login/Signup
  if (!isAuthenticated) {
    return <LoginView onLoggedIn={() => {}} />;
  }

  // 3. If user is authenticated but profile is incomplete, show Complete Profile
  if (!isProfileComplete) {
    return <CompleteProfileView onComplete={() => {}} />;
  }

  // 4. Default: User is fully authenticated with complete profile -> Main App Layout with Bottom Navigation!
  return <MainAppLayout />;
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 48,
  },
  splashContent: {
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 'auto',
    paddingHorizontal: 24,
  },
  domainBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 24,
  },
  domainBadgeText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 30,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 6,
  },
  splashBrand: {
    fontFamily: Fonts.heading,
    fontSize: 43,
    fontWeight: '700',
    letterSpacing: 1.2,
    textAlign: 'center',
    lineHeight: 49,
  },
  splashBrandAccent: {
    fontFamily: Fonts.headingOblique,
    fontWeight: '700',
  },
  splashTagline: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 16,
    marginTop: 10,
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 36,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
  },
  loadingText: {
    fontFamily: Fonts.bodyDemiBold,
    fontSize: 13.5,
    letterSpacing: 0.4,
  },
  splashFooter: {
    alignItems: 'center',
  },
  footerVersion: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    letterSpacing: 0.8,
  },
});

