import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Share,
  BackHandler,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useAlert } from '@/context/AlertContext';
import { StyledAlertButton } from '../StyledAlertModal';
import { Fonts } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/context/ThemeContext';

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

export function WalletPage({ onBack }: { onBack: () => void }) {
  const { user, transactions, simulateFriendReferral } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const { showAlert } = useAlert();
  const [copiedCode, setCopiedCode] = useState(false);

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
              <Text style={[styles.headerTitle, { color: colors.text }]}>Wallet & Coins</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                Axiom Coins, academic grant ledger & referrals
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
        {/* 1. Main Wallet Spotlight Card */}
        <AnimatedCard
          index={0}
          style={[
            styles.walletCard,
            {
              backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
              borderColor: isDark ? 'rgba(245, 158, 11, 0.40)' : 'rgba(217, 119, 6, 0.35)',
            },
          ]}>
          <View style={[styles.cardAccentLine, { backgroundColor: '#F59E0B' }]} />

          <View style={styles.walletHeader}>
            <View style={styles.walletHeaderLeft}>
              <View style={[styles.coinIconSquircle, { backgroundColor: 'rgba(245, 158, 11, 0.16)' }]}>
                <Ionicons name="sparkles" size={20} color="#F59E0B" />
              </View>
              <View>
                <Text style={[styles.walletTitle, { color: colors.text }]}>AxiomByte Coin Balance</Text>
                <Text style={styles.walletRateText}>Grant Ratio: 100 Coins ≈ ₹1.00 INR</Text>
              </View>
            </View>
            <View style={styles.coinBadge}>
              <Text style={styles.coinBadgeText}>{user.coins} COINS</Text>
            </View>
          </View>

          <View style={styles.balanceRow}>
            <View>
              <Text style={[styles.balanceSubLabel, { color: colors.textMuted }]}>EQUIVALENT GRANT VALUE</Text>
              <Text style={styles.balanceBigText}>₹{inrBalance}</Text>
            </View>
            <Pressable
              onPress={handleShareReferral}
              style={({ pressed }) => [
                styles.referralActionBtn,
                { backgroundColor: '#F59E0B' },
                pressed && { opacity: 0.85 },
              ]}>
              <Ionicons name="share-social" size={15} color="#0F172A" />
              <Text style={styles.referralActionText}>Share Invite</Text>
            </Pressable>
          </View>

          {/* Test Referral Credit Action — visible in dev builds only */}
          {__DEV__ && (
            <Pressable
              onPress={handleTestReferralReward}
              style={({ pressed }) => [
                styles.simulateRewardBtn,
                { backgroundColor: colors.cardSecondary, borderColor: colors.border },
                pressed && { opacity: 0.75 },
              ]}>
              <Ionicons name="sparkles" size={14} color="#F59E0B" />
              <Text style={[styles.simulateRewardText, { color: colors.text }]}>
                Simulate Friend Referral (+200 Coins = ₹2.00)
              </Text>
            </Pressable>
          )}
        </AnimatedCard>

        {/* 2. Referral Code Box */}
        <AnimatedCard
          index={1}
          style={[styles.cardBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconBadge, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
              <Ionicons name="gift-outline" size={16} color="#F59E0B" />
            </View>
            <View>
              <Text style={[styles.subSectionTitle, { color: colors.text }]}>Your Invite Voucher</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
                Share your personal code with college peers
              </Text>
            </View>
          </View>

          <Text style={[styles.policyParagraph, { color: colors.textSecondary }]}>
            Invite college classmates. When they register with your code, they get 100 bonus coins and you receive 200 coins credited instantly to your wallet.
          </Text>

          <View style={[styles.codeCopyBox, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
            <Text style={[styles.codeBoxValue, { color: colors.primary }]}>{user.referralCode}</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Pressable
                onPress={handleCopyCode}
                style={[
                  styles.copyBtnPill,
                  {
                    backgroundColor: copiedCode ? 'rgba(16, 185, 129, 0.16)' : colors.card,
                    borderColor: copiedCode ? '#10B981' : colors.border,
                  },
                ]}>
                <Ionicons
                  name={copiedCode ? 'checkmark' : 'copy-outline'}
                  size={14}
                  color={copiedCode ? '#10B981' : colors.primary}
                />
                <Text
                  style={[
                    styles.copyBtnPillText,
                    { color: copiedCode ? '#10B981' : colors.primary },
                  ]}>
                  {copiedCode ? 'Copied' : 'Copy'}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleShareReferral}
                style={[styles.copyBtnPill, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                <Ionicons name="share-social-outline" size={14} color="#0F172A" />
                <Text style={[styles.copyBtnPillText, { color: '#0F172A' }]}>Share</Text>
              </Pressable>
            </View>
          </View>
        </AnimatedCard>

        {/* 3. Transaction Ledger */}
        <AnimatedCard
          index={2}
          style={[styles.cardBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.ledgerHeaderRow}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionIconBadge, { backgroundColor: 'rgba(56, 189, 248, 0.12)' }]}>
                <Ionicons name="receipt-outline" size={16} color="#38BDF8" />
              </View>
              <Text style={[styles.subSectionTitle, { color: colors.text }]}>Transaction Ledger</Text>
            </View>
            <View style={[styles.recordCountBadge, { backgroundColor: colors.cardSecondary }]}>
              <Text style={[styles.txCountMeta, { color: colors.textMuted }]}>
                {transactions.length} records
              </Text>
            </View>
          </View>

          {transactions.length === 0 ? (
            <View style={styles.emptyLedgerContainer}>
              <Ionicons name="wallet-outline" size={32} color={colors.textMuted} />
              <Text style={[styles.emptyLedger, { color: colors.textMuted }]}>
                No transactions yet. Share your code to earn your first coins!
              </Text>
            </View>
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
                      backgroundColor:
                        tx.amount > 0 ? 'rgba(16, 185, 129, 0.14)' : 'rgba(239, 68, 68, 0.14)',
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
                  <Text
                    style={[
                      styles.txAmount,
                      { color: tx.amount > 0 ? '#10B981' : colors.error },
                    ]}>
                    {tx.amount > 0 ? `+${tx.amount}` : tx.amount}c
                  </Text>
                  <Text style={[styles.txInrSmall, { color: colors.textSecondary }]}>
                    ₹{(Math.abs(tx.amount) / 100).toFixed(2)}
                  </Text>
                </View>
              </View>
            ))
          )}
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
  cardAccentLine: {
    height: 3,
    position: 'absolute',
    top: 0,
    left: 18,
    right: 18,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
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
    marginBottom: 8,
  },
  sectionIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
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
  walletCard: {
    position: 'relative',
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
  },
  walletHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 4,
  },
  walletHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  coinIconSquircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  balanceBigText: {
    fontFamily: Fonts.heading,
    fontSize: 32,
    fontWeight: '800',
    color: '#F59E0B',
  },
  referralActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  referralActionText: {
    fontFamily: Fonts.heading,
    fontSize: 13.5,
    fontWeight: '800',
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
    marginTop: 6,
  },
  simulateRewardText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '600',
  },
  policyParagraph: {
    fontFamily: Fonts.body,
    fontSize: 13,
    lineHeight: 18.5,
    marginBottom: 8,
  },
  codeCopyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 6,
  },
  codeBoxValue: {
    fontFamily: Fonts.mono,
    fontSize: 18,
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
    borderWidth: 1,
  },
  copyBtnPillText: {
    fontFamily: Fonts.mono,
    fontSize: 11.5,
    fontWeight: '700',
  },
  ledgerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  recordCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  txCountMeta: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '600',
  },
  emptyLedgerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyLedger: {
    fontFamily: Fonts.body,
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 240,
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
    borderRadius: 10,
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
});

