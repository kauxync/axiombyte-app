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
import { fetchLegalPolicies, LegalPoliciesData } from '@/services/api';
import { MarkdownContentView } from '../MarkdownContentView';
import { Fonts } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/context/ThemeContext';

export type PolicyKey = 'terms' | 'privacy' | 'referral_policy';

const POLICY_TITLES: Record<PolicyKey, string> = {
  terms: 'Terms & Conditions',
  privacy: 'Privacy Policy',
  referral_policy: 'Referral & Reward Policy',
};

const POLICY_SUBTITLES: Record<PolicyKey, string> = {
  terms: 'Academic integrity, terms of service & software usage rules',
  privacy: 'Student data security, DPDP compliance & zero ad-tracking',
  referral_policy: 'Reward distribution, 200c invite bonus & redemption rules',
};

export function LegalPolicyPage({
  policyKey,
  onBack,
}: {
  policyKey: PolicyKey;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const [policies, setPolicies] = useState<LegalPoliciesData | null>(null);
  const [loadingPolicies, setLoadingPolicies] = useState<boolean>(false);

  const [fadeAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const loadPoliciesData = async (force = false) => {
    if (loadingPolicies) return;
    setLoadingPolicies(true);
    try {
      const res = await fetchLegalPolicies(force);
      if (res.data) {
        setPolicies(res.data);
      }
    } catch (err) {
      console.log('[Policies] load error:', err);
    } finally {
      setLoadingPolicies(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    fetchLegalPolicies()
      .then((res) => {
        if (isMounted && res.data) {
          setPolicies(res.data);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [policyKey]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const policy = policies ? policies[policyKey] : null;
  const title = policy?.title || POLICY_TITLES[policyKey];
  const subtitle = POLICY_SUBTITLES[policyKey];
  const md = policy?.markdown || '';

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
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                {title}
              </Text>
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => loadPoliciesData(true)}
            disabled={loadingPolicies}
            style={({ pressed }) => [
              styles.headerRefreshBtn,
              { backgroundColor: colors.cardSecondary, borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
            hitSlop={8}>
            {loadingPolicies ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="cloud-download-outline" size={17} color={colors.primary} />
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 80 },
        ]}
        showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Policy Meta Card */}
          <View
            style={[
              styles.policyMetaCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}>
            <View style={styles.policyMetaRow}>
              <View
                style={[
                  styles.policyVersionBadge,
                  { backgroundColor: colors.primaryBg, borderColor: colors.primary },
                ]}>
                <Text style={[styles.policyVersionText, { color: colors.primary }]}>
                  v{policy?.version || '1.2.0'}
                </Text>
              </View>
              <View style={styles.policySyncIndicator}>
                <Ionicons name="shield-checkmark" size={13} color="#10B981" />
                <Text style={[styles.policyLastUpdatedText, { color: colors.textMuted }]}>
                  {policy?.last_updated ? `Updated: ${policy.last_updated}` : 'AxiomByte Verified'}
                </Text>
              </View>
            </View>
            {loadingPolicies && !policies ? (
              <View style={styles.policyLoadingBar}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.policyLoadingText, { color: colors.textMuted }]}>
                  Synchronizing policy from AxiomByte cloud...
                </Text>
              </View>
            ) : null}
          </View>

          {/* Render Markdown Content */}
          <View
            style={[
              styles.cardBlock,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                paddingHorizontal: 16,
                paddingVertical: 18,
              },
            ]}>
            <MarkdownContentView
              content={md}
              colors={colors}
              isDark={isDark}
              accentColor={colors.primary}
            />
          </View>
        </Animated.View>
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
  headerRefreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.heading,
    fontSize: 20,
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
  policyMetaCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  policyMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  policyVersionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  policyVersionText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
  },
  policySyncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  policyLastUpdatedText: {
    fontFamily: Fonts.mono,
    fontSize: 11.5,
    fontWeight: '600',
  },
  policyLoadingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  policyLoadingText: {
    fontFamily: Fonts.mono,
    fontSize: 11.5,
  },
  cardBlock: {
    borderWidth: 1,
    borderRadius: 18,
    marginBottom: 14,
  },
});

