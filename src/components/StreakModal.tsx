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

const WEEK_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WEEK_DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function StreakModal({ visible, onClose, onPracticePress }: StreakModalProps) {
  const { colors, isDark } = useAppTheme();
  const { user, streak, recordStreakActivity, buyStreakFreeze, recoverLostStreak } = useAuth();

  const [buyingFreeze, setBuyingFreeze] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [notice, setNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Today's index in the week (0 = Mon, 6 = Sun)
  const todayWeekIndex = (new Date().getDay() + 6) % 7;

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
          message: '🛡️ Streak Freeze added! Your streak is protected if you miss a day.',
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

  const handleRecoverStreak = async () => {
    setRecovering(true);
    setNotice(null);
    try {
      let res;
      if (streak.freezeCount > 0) {
        res = await recoverLostStreak();
      } else {
        res = await buyStreakFreeze(true);
      }

      if (res.success) {
        setNotice({
          type: 'success',
          message: `🛡️ Streak Freeze applied! Your ${res.restoredStreak || streak.lostStreak}-day streak is fully restored!`,
        });
      } else {
        setNotice({
          type: 'error',
          message: res.error || 'Could not recover streak.',
        });
      }
    } catch {
      setNotice({ type: 'error', message: 'Failed to recover streak.' });
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

            {/* Weekly Calendar Tracker */}
            <View style={[styles.sectionBox, { backgroundColor: colors.cardSecondary }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>THIS WEEK</Text>
                <Text style={[styles.sectionValue, { color: colors.primary }]}>
                  {(streak.weeklyActivity || []).filter(Boolean).length}/7 Days Active
                </Text>
              </View>

              <View style={styles.weekGrid}>
                {WEEK_DAYS.map((letter, idx) => {
                  const isActive = !!(streak.weeklyActivity || [])[idx];
                  const isToday = idx === todayWeekIndex;

                  return (
                    <View key={idx} style={styles.dayCol}>
                      <Text
                        style={[
                          styles.dayLetter,
                          {
                            color: isToday ? colors.primary : colors.textMuted,
                            fontWeight: isToday ? '800' : '500',
                          },
                        ]}>
                        {letter}
                      </Text>

                      <View
                        style={[
                          styles.dayCircle,
                          {
                            backgroundColor: isActive
                              ? 'rgba(255, 90, 60, 0.2)'
                              : isDark
                              ? '#0F172A'
                              : '#E2E8F0',
                            borderColor: isActive
                              ? '#FF5A3C'
                              : isToday
                              ? colors.primary
                              : colors.border,
                            borderWidth: isActive || isToday ? 1.5 : 1,
                          },
                        ]}>
                        {isActive ? (
                          <Ionicons name="flame" size={16} color="#FF5A3C" />
                        ) : isToday ? (
                          <View style={[styles.todayDot, { backgroundColor: colors.primary }]} />
                        ) : (
                          <Text style={[styles.dayNameSub, { color: colors.textMuted }]}>
                            {WEEK_DAY_NAMES[idx][0]}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Lost Streak Recovery Banner */}
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
                      You missed a day, but your streak is protected if you cover it with a Streak Freeze shield.
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={handleRecoverStreak}
                  disabled={recovering || (streak.freezeCount === 0 && (user?.coins || 0) < 50)}
                  style={[
                    styles.recoveryActionBtn,
                    {
                      backgroundColor: '#208AEF',
                      opacity: (streak.freezeCount > 0 || (user?.coins || 0) >= 50) ? 1 : 0.6,
                    },
                  ]}>
                  {recovering ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="shield-checkmark" size={16} color="#FFF" />
                      <Text style={styles.recoveryActionText}>
                        {streak.freezeCount > 0
                          ? 'Use Shield to Restore Streak'
                          : 'Buy Freeze & Restore Streak (50 🪙)'}
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
                  <Text style={[styles.freezeTitle, { color: colors.text }]}>Streak Freeze</Text>
                  <Text style={[styles.freezeDesc, { color: colors.textMuted }]}>
                    {streak.freezeCount > 0
                      ? `${streak.freezeCount} shield active • Protects if you miss 1 day`
                      : 'No freeze active • Streak will reset if a day is missed'}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={handleBuyFreeze}
                disabled={buyingFreeze || (user?.coins || 0) < 50}
                style={[
                  styles.buyFreezeBtn,
                  {
                    backgroundColor: (user?.coins || 0) >= 50 ? colors.primary : colors.card,
                    opacity: (user?.coins || 0) >= 50 ? 1 : 0.6,
                  },
                ]}>
                {buyingFreeze ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="add" size={14} color="#FFF" />
                    <Text style={styles.buyFreezeText}>50 🪙</Text>
                  </>
                )}
              </Pressable>
            </View>

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

            {/* Quick Action Button */}
            {!streak.todayCompleted ? (
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
            ) : (
              <Pressable
                onPress={() => {
                  onClose();
                  if (onPracticePress) onPracticePress();
                }}
                style={[styles.actionBtn, { backgroundColor: colors.primary }]}>
                <Ionicons name="hardware-chip-outline" size={18} color="#FFF" />
                <Text style={styles.actionBtnText}>Continue Practicing in C Stepper</Text>
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
  sectionBox: {
    borderRadius: 16,
    padding: 16,
    marginVertical: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 11.5,
    letterSpacing: 1,
  },
  sectionValue: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
  },
  weekGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCol: {
    alignItems: 'center',
    gap: 6,
  },
  dayLetter: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
  },
  dayCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dayNameSub: {
    fontFamily: Fonts.body,
    fontSize: 11,
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
