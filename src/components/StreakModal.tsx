import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '@/constants/theme';
import { useAppTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { ActivityCalendar } from './ActivityCalendar';

interface StreakModalProps {
  visible: boolean;
  onClose: () => void;
  onPracticePress?: () => void;
}

const MILESTONES = [
  { days: 3, bonus: 25, title: 'Ignition', desc: '3 consecutive days of study' },
  { days: 7, bonus: 70, title: 'Flame Keeper', desc: '1 solid week of mastery' },
  { days: 14, bonus: 150, title: 'Systems Adept', desc: '2 continuous weeks' },
  { days: 30, bonus: 350, title: 'Epistemic Titan', desc: '1 month of mathematical discipline' },
];

export function StreakModal({ visible, onClose, onPracticePress }: StreakModalProps) {
  const { colors, isDark } = useAppTheme();
  const { user, streak, recordStreakActivity, buyStreakFreeze, restoreStreak } = useAuth();

  const [buyingFreeze, setBuyingFreeze] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [notice, setNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleClaimToday = async () => {
    setClaiming(true);
    setNotice(null);
    try {
      const res = await recordStreakActivity();
      if (res.coinsAwarded > 0) {
        setNotice({
          type: 'success',
          message: `🔥 Streak extended to ${res.newStreak} days! +${res.coinsAwarded} Coins earned!`,
        });
      } else {
        setNotice({
          type: 'success',
          message: `🔥 You're all caught up for today! Streak: ${res.newStreak} days.`,
        });
      }
    } catch {
      setNotice({ type: 'error', message: 'Failed to update streak.' });
    } finally {
      setClaiming(false);
    }
  };

  const handleBuyFreeze = async () => {
    setBuyingFreeze(true);
    setNotice(null);
    try {
      const res = await buyStreakFreeze();
      if (res.success) {
        setNotice({
          type: 'success',
          message: '🛡️ Streak Freeze acquired! Your streak is protected if you miss a day.',
        });
      } else {
        setNotice({
          type: 'error',
          message: res.error || 'Could not purchase freeze.',
        });
      }
    } catch {
      setNotice({ type: 'error', message: 'Could not purchase freeze.' });
    } finally {
      setBuyingFreeze(false);
    }
  };

  const handleRestoreStreak = async () => {
    setRecovering(true);
    setNotice(null);
    try {
      const res = await restoreStreak();
      if (res.success) {
        setNotice({
          type: 'success',
          message: `✨ Streak Restored! Your ${res.restoredStreak || streak.lostStreak}-day streak is fully restored!`,
        });
      } else {
        setNotice({
          type: 'error',
          message: res.error || 'Could not restore streak.',
        });
      }
    } catch {
      setNotice({ type: 'error', message: 'Failed to restore streak.' });
    } finally {
      setRecovering(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}>
          {/* Header Bar */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={[styles.miniFlame, { backgroundColor: 'rgba(255, 90, 60, 0.15)' }]}>
                <Ionicons name="flame" size={16} color="#FF5A3C" />
              </View>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Daily Learning Streak</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {/* Notice Banner */}
            {notice && (
              <View
                style={[
                  styles.noticeBox,
                  {
                    backgroundColor:
                      notice.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    borderColor: notice.type === 'success' ? '#10B981' : '#EF4444',
                  },
                ]}>
                <Ionicons
                  name={notice.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
                  size={18}
                  color={notice.type === 'success' ? '#10B981' : '#EF4444'}
                />
                <Text
                  style={[
                    styles.noticeText,
                    { color: notice.type === 'success' ? colors.text : '#EF4444' },
                  ]}>
                  {notice.message}
                </Text>
              </View>
            )}

            {/* Main Flame Hero */}
            <View style={styles.heroSection}>
              <View style={styles.flameOuterRing}>
                <View style={styles.flameMidRing}>
                  <View style={styles.flameInnerBadge}>
                    <Ionicons name="flame" size={48} color="#FF5A3C" />
                  </View>
                </View>
              </View>

              <Text style={[styles.streakCountNumber, { color: colors.text }]}>
                {streak.currentStreak}
                <Text style={{ fontSize: 25, color: '#FF5A3C' }}> Days</Text>
              </Text>

              <Text style={[styles.statusSubtitle, { color: colors.textSecondary }]}>
                {streak.todayCompleted
                  ? "🔥 You're on fire! You completed today's study goal."
                  : '⚠️ Keep the flame alive! Complete a session today.'}
              </Text>

              <View style={[styles.recordBadge, { backgroundColor: colors.cardSecondary }]}>
                <Ionicons name="trophy-outline" size={13} color="#F59E0B" />
                <Text style={[styles.recordText, { color: colors.textMuted }]}>
                  Personal Best:{' '}
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    {streak.longestStreak} days
                  </Text>
                </Text>
              </View>
            </View>

            {/* Lost Streak Restore Banner */}
            {!!streak.lostStreak && streak.lostStreak > 0 && (
              <View
                style={[
                  styles.recoveryCard,
                  {
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    borderColor: '#EF4444',
                  },
                ]}>
                <View style={styles.recoveryHeader}>
                  <Text style={styles.recoveryEmoji}>💔</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.recoveryTitle, { color: '#EF4444' }]}>
                      {streak.lostStreak}-Day Streak Lost!
                    </Text>
                    <Text style={[styles.recoveryDesc, { color: colors.textMuted }]}>
                      Your previous streak was lost. Use Streak Restore to recover your full {streak.lostStreak}-day streak and metadata.
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={handleRestoreStreak}
                  disabled={recovering || (user?.coins || 0) < 50}
                  style={[
                    styles.recoveryActionBtn,
                    {
                      backgroundColor: '#208AEF',
                      opacity: (user?.coins || 0) >= 50 ? 1 : 0.6,
                    },
                  ]}>
                  {recovering ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={16} color="#FFF" />
                      <Text style={styles.recoveryActionText}>
                        Restore Streak (50 🪙)
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}

            {/* Freeze Protection Banner if Shield was used today */}
            {streak.freezeUsedToday && (
              <View
                style={[
                  styles.shieldAlertCard,
                  {
                    backgroundColor: 'rgba(56, 189, 248, 0.12)',
                    borderColor: 'rgba(56, 189, 248, 0.35)',
                  },
                ]}>
                <Ionicons name="shield-checkmark" size={20} color="#38BDF8" />
                <Text style={[styles.shieldAlertText, { color: '#38BDF8' }]}>
                  🛡️ Streak Freeze Shield Protected Your Streak! You missed a day, but your {streak.currentStreak}-day streak was saved.
                </Text>
              </View>
            )}

            {/* Streak Freeze Shield Card */}
            {(() => {
              const freezeStatus = streak.freezeStatus || (streak.freezeCount > 0 ? 'available' : 'none');
              const hasActiveFreeze = freezeStatus === 'available' || streak.freezeCount > 0;

              return (
                <View
                  style={[
                    styles.freezeCard,
                    {
                      backgroundColor: colors.cardSecondary,
                      borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(2, 132, 199, 0.2)',
                    },
                  ]}>
                  <View style={styles.freezeLeft}>
                    <View style={[styles.shieldIconBox, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                      <Ionicons name="shield-checkmark" size={22} color="#38BDF8" />
                    </View>
                    <View style={styles.freezeInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.freezeTitle, { color: colors.text }]}>Streak Freeze</Text>
                        <View
                          style={{
                            paddingHorizontal: 7,
                            paddingVertical: 2,
                            borderRadius: 6,
                            backgroundColor:
                              freezeStatus === 'available'
                                ? 'rgba(16, 185, 129, 0.15)'
                                : freezeStatus === 'used'
                                ? 'rgba(245, 158, 11, 0.15)'
                                : 'rgba(148, 163, 184, 0.15)',
                          }}>
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: '700',
                              color:
                                freezeStatus === 'available'
                                  ? '#10B981'
                                  : freezeStatus === 'used'
                                  ? '#F59E0B'
                                  : colors.textMuted,
                              textTransform: 'uppercase',
                            }}>
                            {freezeStatus === 'available'
                              ? 'Available'
                              : freezeStatus === 'used'
                              ? 'Used'
                              : 'None'}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.freezeDesc, { color: colors.textMuted }]}>
                        {hasActiveFreeze
                          ? '1 shield stored in account • Protects your next missed day (Max 1)'
                          : freezeStatus === 'used'
                          ? 'Previous shield was consumed • Ready to purchase a new shield'
                          : 'No freeze active • Protect against future missed days'}
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    onPress={handleBuyFreeze}
                    disabled={hasActiveFreeze || buyingFreeze || (user?.coins || 0) < 50}
                    style={[
                      styles.buyFreezeBtn,
                      {
                        backgroundColor: hasActiveFreeze
                          ? 'rgba(16, 185, 129, 0.2)'
                          : (user?.coins || 0) >= 50
                          ? colors.primary
                          : colors.card,
                        opacity: hasActiveFreeze ? 0.9 : (user?.coins || 0) >= 50 ? 1 : 0.6,
                        borderWidth: hasActiveFreeze ? 1 : 0,
                        borderColor: hasActiveFreeze ? '#10B981' : 'transparent',
                      },
                    ]}>
                    {buyingFreeze ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : hasActiveFreeze ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="checkmark" size={13} color="#10B981" />
                        <Text style={[styles.buyFreezeText, { color: '#10B981', fontSize: 11 }]}>Active (Max 1)</Text>
                      </View>
                    ) : (
                      <>
                        <Ionicons name="add" size={14} color="#FFF" />
                        <Text style={styles.buyFreezeText}>50 🪙</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              );
            })()}

            {/* GitHub & LeetCode Style Activity Calendar (Tracks streaks, freezes & restores) */}
            <ActivityCalendar
              userId={user?.id}
              year={2026}
              startDate="2026-10-20"
              refreshTrigger={`${streak.lastActiveDate}_${streak.currentStreak}_${streak.todayCompleted}_${streak.freezeStatus}_${streak.lostStreak}`}
            />

            {/* Milestones Ladder */}
            <View style={[styles.milestonesSection, { backgroundColor: colors.cardSecondary }]}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted, marginBottom: 12 }]}>
                STREAK REWARD MILESTONES
              </Text>

              {MILESTONES.map((item, idx) => {
                const reached = streak.currentStreak >= item.days;

                return (
                  <View
                    key={idx}
                    style={[
                      styles.milestoneRow,
                      {
                        borderBottomColor: colors.border,
                        borderBottomWidth: idx < MILESTONES.length - 1 ? 1 : 0,
                      },
                    ]}>
                    <View style={styles.milestoneLeft}>
                      <View
                        style={[
                          styles.milestoneIconBox,
                          {
                            backgroundColor: reached
                              ? 'rgba(245, 158, 11, 0.18)'
                              : isDark
                              ? '#0F172A'
                              : '#E2E8F0',
                          },
                        ]}>
                        <Ionicons
                          name={reached ? 'checkmark-circle' : 'flame-outline'}
                          size={18}
                          color={reached ? '#F59E0B' : colors.textMuted}
                        />
                      </View>
                      <View>
                        <Text
                          style={[
                            styles.milestoneTitle,
                            { color: reached ? colors.text : colors.textMuted },
                          ]}>
                          {item.title} ({item.days} Days)
                        </Text>
                        <Text style={[styles.milestoneDesc, { color: colors.textMuted }]}>
                          {item.desc}
                        </Text>
                      </View>
                    </View>

                    <View style={[styles.rewardBadge, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                      <Text style={styles.rewardCoinsText}>+{item.bonus} 🪙</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Quick Action Button - only shown when today's study goal is pending */}
            {!streak.todayCompleted && (
              <Pressable
                onPress={handleClaimToday}
                disabled={claiming}
                style={[styles.actionBtn, { backgroundColor: '#FF5A3C' }]}>
                {claiming ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={18} color="#FFF" />
                    <Text style={styles.actionBtnText}>Log Today&apos;s Practice (+10 Coins)</Text>
                  </>
                )}
              </Pressable>
            )}
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniFlame: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.heading,
    fontSize: 17,
  },
  closeBtn: {
    padding: 4,
  },
  scroll: {
    paddingBottom: 8,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  noticeText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13.5,
    flex: 1,
  },
  heroSection: {
    alignItems: 'center',
    marginVertical: 12,
  },
  flameOuterRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255, 90, 60, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameMidRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255, 90, 60, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameInnerBadge: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255, 90, 60, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakCountNumber: {
    fontFamily: Fonts.heading,
    fontSize: 35,
    marginTop: 12,
  },
  statusSubtitle: {
    fontFamily: Fonts.body,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
  recordBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 10,
  },
  recordText: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
  },
  sectionLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 11.5,
    letterSpacing: 1,
  },
  freezeCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  freezeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  shieldIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freezeInfo: {
    flex: 1,
  },
  freezeTitle: {
    fontFamily: Fonts.heading,
    fontSize: 15,
    marginBottom: 2,
  },
  freezeDesc: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    lineHeight: 16,
  },
  buyFreezeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginLeft: 8,
  },
  buyFreezeText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: '#FFF',
  },
  milestonesSection: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  milestoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  milestoneLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  milestoneIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneTitle: {
    fontFamily: Fonts.heading,
    fontSize: 13.5,
  },
  milestoneDesc: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    marginTop: 1,
  },
  rewardBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rewardCoinsText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    color: '#F59E0B',
  },
  actionBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 4,
  },
  actionBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 15,
    color: '#FFF',
  },
  recoveryCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  recoveryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  recoveryEmoji: {
    fontSize: 28,
  },
  recoveryTitle: {
    fontFamily: Fonts.heading,
    fontSize: 16,
    marginBottom: 4,
  },
  recoveryDesc: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    lineHeight: 17,
  },
  recoveryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  recoveryActionText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    color: '#FFF',
  },
  shieldAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  shieldAlertText: {
    flex: 1,
    fontFamily: Fonts.bodyBold,
    fontSize: 12.5,
    lineHeight: 17,
  },
});
