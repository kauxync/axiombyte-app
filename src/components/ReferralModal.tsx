import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { Fonts } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/context/ThemeContext';
import { useAlert } from '@/context/AlertContext';

export function ReferralModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { user, transactions } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { showAlert } = useAlert();
  const [copied, setCopied] = useState(false);

  const Alert = {
    alert: (title: string, message?: string) => showAlert(title, message),
  };

  if (!user) return null;

  const inrBalance = (user.coins / 100).toFixed(2);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `🚀 Join me on AxiomByte to learn Computer Science (C, C++) and Discrete Mathematics with interactive memory steppers!\n\nUse my referral code "${user.referralCode}" to get 100 free Coins (₹1.00) on signup!`,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    Alert.alert('Copied!', `Referral code "${user.referralCode}" copied to clipboard.`);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 20) + 16,
            },
          ]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.titleRow}>
              <View style={styles.coinIconCircle}>
                <Ionicons name="gift" size={20} color="#F59E0B" />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>Referral & Coin Wallet</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Balance Card */}
            <View
              style={[
                styles.balanceCard,
                {
                  backgroundColor: colors.cardSecondary,
                  borderColor: colors.border,
                },
              ]}>
              <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>YOUR TOTAL BALANCE</Text>
              <View style={styles.coinDisplayRow}>
                <Text style={styles.coinEmoji}>🪙</Text>
                <Text style={styles.coinValue}>{user.coins}</Text>
                <Text style={[styles.coinUnit, { color: colors.textSecondary }]}>Coins</Text>
              </View>
              <View style={styles.inrBadge}>
                <Text style={styles.inrText}>≈ ₹{inrBalance} INR (Rate: 100 Coins = ₹1)</Text>
              </View>
            </View>

            {/* Referral Rule Banner */}
            <View style={[styles.ruleBox, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
              <View style={styles.ruleItem}>
                <View style={[styles.ruleCircle, { backgroundColor: '#10B981' }]}>
                  <Ionicons name="people" size={16} color="#FFFFFF" />
                </View>
                <View style={styles.ruleTextCol}>
                  <Text style={[styles.ruleHeading, { color: colors.text }]}>1 Refer = 200 Coins (₹2.00)</Text>
                  <Text style={[styles.ruleSub, { color: colors.textSecondary }]}>
                    Every friend who registers with your code earns you 200 coins.
                  </Text>
                </View>
              </View>

              <View style={styles.ruleItem}>
                <View style={[styles.ruleCircle, { backgroundColor: '#38BDF8' }]}>
                  <Ionicons name="sparkles" size={16} color="#FFFFFF" />
                </View>
                <View style={styles.ruleTextCol}>
                  <Text style={[styles.ruleHeading, { color: colors.text }]}>Friend Gets 100 Coins (₹1.00)</Text>
                  <Text style={[styles.ruleSub, { color: colors.textSecondary }]}>
                    Your friend receives an instant 100 welcome coins bonus.
                  </Text>
                </View>
              </View>
            </View>

            {/* Code Box */}
            <View
              style={[
                styles.codeContainer,
                {
                  backgroundColor: colors.cardSecondary,
                  borderColor: colors.border,
                },
              ]}>
              <Text style={[styles.codeLabel, { color: colors.textMuted }]}>YOUR UNIQUE REFERRAL CODE</Text>
              <View style={styles.codeRow}>
                <Text style={[styles.codeText, { color: colors.primary }]}>{user.referralCode}</Text>
                <Pressable onPress={handleCopy} style={styles.copyBtn}>
                  <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color={colors.primary} />
                  <Text style={[styles.copyBtnText, { color: colors.primary }]}>{copied ? 'Copied' : 'Copy'}</Text>
                </Pressable>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <Pressable onPress={handleShare} style={[styles.shareBtn, { backgroundColor: colors.primary }]}>
                <Ionicons name="share-social" size={18} color="#0F172A" />
                <Text style={styles.shareBtnText}>Share With Classmates</Text>
              </Pressable>
            </View>

            {/* Transaction Ledger */}
            <View style={styles.ledgerSection}>
              <View style={styles.ledgerHeaderRow}>
                <Text style={[styles.ledgerTitle, { color: colors.text }]}>Transaction History</Text>
                {transactions.length > 0 && (
                  <View style={[styles.txCountBadge, { backgroundColor: colors.cardSecondary }]}>
                    <Text style={[styles.txCountText, { color: colors.primary }]}>
                      {transactions.length} {transactions.length === 1 ? 'record' : 'records'}
                    </Text>
                  </View>
                )}
              </View>

              {transactions.length === 0 ? (
                <View style={[styles.emptyContainer, { backgroundColor: colors.cardSecondary, borderColor: colors.borderSubtle }]}>
                  <View style={[styles.emptyIconCircle, { backgroundColor: colors.card }]}>
                    <Ionicons name="receipt-outline" size={26} color={colors.textMuted} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No Transactions Yet</Text>
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                    Share your invite code with friends. When they register, your coin bonuses and earnings will appear here!
                  </Text>
                </View>
              ) : (
                transactions.map((tx) => (
                  <View
                    key={tx.id}
                    style={[
                      styles.txRow,
                      {
                        backgroundColor: colors.cardSecondary,
                        borderColor: colors.borderSubtle,
                      },
                    ]}>
                    <View style={styles.txLeft}>
                      <View
                        style={[
                          styles.txIcon,
                          {
                            backgroundColor: tx.amount > 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          },
                        ]}>
                        <Ionicons
                          name={tx.amount > 0 ? 'arrow-down-circle' : 'arrow-up-circle'}
                          size={19}
                          color={tx.amount > 0 ? '#10B981' : colors.error}
                        />
                      </View>
                      <View style={styles.txTextCol}>
                        <Text style={[styles.txDesc, { color: colors.text }]} numberOfLines={2}>
                          {tx.description}
                        </Text>
                        <View style={styles.txMetaRow}>
                          <Ionicons name="time-outline" size={11} color={colors.textMuted} />
                          <Text style={[styles.txTime, { color: colors.textMuted }]}>{tx.timestamp}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.txRight}>
                      <Text style={[styles.txAmount, { color: tx.amount > 0 ? '#10B981' : colors.error }]}>
                        {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                      </Text>
                      <Text style={[styles.txInr, { color: colors.textSecondary }]}>
                        ₹{(Math.abs(tx.amount) / 100).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    paddingBottom: 30,
    borderWidth: 1,
    borderColor: '#334155',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  coinIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 21,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  closeBtn: {
    padding: 6,
  },
  scrollContent: {
    padding: 24,
  },
  balanceCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  balanceLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: '#94A3B8',
    letterSpacing: 1,
    fontWeight: '700',
  },
  coinDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 10,
  },
  coinEmoji: {
    fontSize: 33,
  },
  coinValue: {
    fontFamily: Fonts.heading,
    fontSize: 41,
    fontWeight: '700',
    color: '#F59E0B',
  },
  coinUnit: {
    fontFamily: Fonts.bodyBold,
    fontSize: 19,
    fontWeight: '700',
    color: '#CBD5E1',
    marginTop: 10,
  },
  inrBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  inrText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    color: '#34D399',
    fontWeight: '700',
  },
  ruleBox: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    marginBottom: 20,
  },
  ruleItem: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  ruleCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ruleTextCol: {
    flex: 1,
  },
  ruleHeading: {
    fontFamily: Fonts.heading,
    fontSize: 16,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  ruleSub: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  codeContainer: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 16,
  },
  codeLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  codeText: {
    fontFamily: Fonts.heading,
    fontSize: 23,
    fontWeight: '700',
    color: '#38BDF8',
    letterSpacing: 2,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  copyBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    fontWeight: '700',
    color: '#38BDF8',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#38BDF8',
    paddingVertical: 14,
    borderRadius: 14,
  },
  shareBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  ledgerSection: {
    marginTop: 8,
  },
  ledgerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ledgerTitle: {
    fontFamily: Fonts.heading,
    fontSize: 18,
    fontWeight: '700',
  },
  txCountBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
  },
  txCountText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    fontFamily: Fonts.heading,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  txIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txTextCol: {
    flex: 1,
  },
  txDesc: {
    fontFamily: Fonts.heading,
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 18,
  },
  txMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  txTime: {
    fontFamily: Fonts.mono,
    fontSize: 11,
  },
  txRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
    minWidth: 70,
  },
  txAmount: {
    fontFamily: Fonts.mono,
    fontSize: 16,
    fontWeight: '800',
  },
  txInr: {
    fontFamily: Fonts.mono,
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2,
  },
});
