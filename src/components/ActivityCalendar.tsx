import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/context/ThemeContext';
import { Fonts } from '@/constants/theme';
import {
  fetchActivityCalendarApi,
  ActivityCalendarItem,
  ActivityCalendarData,
} from '@/services/api';

export const APP_LAUNCH_DATE = '2026-10-20';

interface ActivityCalendarProps {
  userId?: string;
  days?: number;
  year?: number;
  startDate?: string;
  refreshTrigger?: any;
}

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function formatDisplayDate(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      const now = new Date();
      if (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      ) {
        return 'Today';
      }
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    }
  } catch {}
  return dateStr;
}

export function ActivityCalendar({
  userId,
  days = 91,
  year = 2026,
  startDate = APP_LAUNCH_DATE,
  refreshTrigger,
}: ActivityCalendarProps) {
  const { colors, isDark } = useAppTheme();
  const scrollRef = useRef<any>(null);

  const [data, setData] = useState<ActivityCalendarData | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const [selectedDay, setSelectedDay] = useState<ActivityCalendarItem | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!userId) return;

    fetchActivityCalendarApi(userId, days, year, startDate)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          setData(res.data);
          // Default selection to today (last item in array)
          const cal = res.data.calendar;
          if (cal.length > 0) {
            setSelectedDay(cal[cal.length - 1]);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userId, days, year, startDate, refreshTrigger]);

  // Group continuous days into weeks (columns of 7 days, Monday to Sunday)
  const weeks = useMemo(() => {
    if (!data?.calendar) return [];

    const items = data.calendar;
    const weekCols: ActivityCalendarItem[][] = [];
    let currentWeek: ActivityCalendarItem[] = [];

    // The first date might not be Monday. We pad the first week so dayOfWeek matches Monday = 0
    if (items.length > 0) {
      const firstDay = items[0];
      // Convert Sunday=0 to Monday=0: (dayOfWeek + 6) % 7
      const startOffset = (firstDay.dayOfWeek + 6) % 7;
      for (let p = 0; p < startOffset; p++) {
        currentWeek.push({
          date: `pad_${p}`,
          dayOfWeek: (p + 1) % 7,
          month: '',
          count: -1, // padding
          level: 0,
          status: 'missed',
          xp: 0,
          streak: 0,
        });
      }
    }

    for (const day of items) {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weekCols.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      // Pad end of last week
      while (currentWeek.length < 7) {
        currentWeek.push({
          date: `pad_end_${currentWeek.length}`,
          dayOfWeek: currentWeek.length,
          month: '',
          count: -1,
          level: 0,
          status: 'missed',
          xp: 0,
          streak: 0,
        });
      }
      weekCols.push(currentWeek);
    }

    return weekCols;
  }, [data]);

  // Helper to color cells matching GitHub & LeetCode color hierarchy
  const getCellColor = (item: ActivityCalendarItem) => {
    if (item.count === -1) return 'transparent'; // Padding cell

    if (item.status === 'frozen') {
      return '#06B6D4'; // Cyan Frost for Streak Freeze
    }
    if (item.status === 'restored') {
      return '#8B5CF6'; // Violet Sparkle for Streak Restore
    }

    if (item.count === 0 || item.status === 'missed') {
      return isDark ? '#1E293B' : '#E2E8F0';
    }

    // Active learning levels (LeetCode / GitHub green progression)
    switch (item.level) {
      case 1:
        return isDark ? '#064E3B' : '#86EFAC';
      case 2:
        return isDark ? '#047857' : '#4ADE80';
      case 3:
        return '#10B981';
      case 4:
      default:
        return '#059669';
    }
  };

  const summary = data?.summary;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}>
      {/* Header with Title & Stats */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <Ionicons name="calendar-outline" size={18} color="#FF5A3C" />
          <View>
            <Text style={[styles.title, { color: colors.text }]}>2026 Activity Calendar</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              From 20 Oct 2026 • Daily Streak & Activity
            </Text>
          </View>
        </View>
        {summary && (
          <View style={[styles.streakBadge, { backgroundColor: 'rgba(255, 90, 60, 0.12)' }]}>
            <Ionicons name="flame" size={14} color="#FF5A3C" />
            <Text style={styles.streakBadgeText}>{summary.currentStreak}d Streak</Text>
          </View>
        )}
      </View>

      {/* Summary KPI Badges */}
      {summary && (
        <View style={styles.kpiRow}>
          <View style={styles.kpiItem}>
            <Text style={[styles.kpiNumber, { color: '#10B981' }]}>
              {summary.totalActiveDays}
            </Text>
            <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>Active Days</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiItem}>
            <Text style={[styles.kpiNumber, { color: '#F59E0B' }]}>
              {summary.totalContributions}
            </Text>
            <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>Sessions</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiItem}>
            <Text style={[styles.kpiNumber, { color: colors.primary }]}>
              {summary.longestStreak}d
            </Text>
            <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>Best Streak</Text>
          </View>
          {summary.totalFrozenDays > 0 && (
            <>
              <View style={styles.kpiDivider} />
              <View style={styles.kpiItem}>
                <Text style={[styles.kpiNumber, { color: '#06B6D4' }]}>
                  {summary.totalFrozenDays}
                </Text>
                <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>Frozen</Text>
              </View>
            </>
          )}
          {summary.totalRestoredDays > 0 && (
            <>
              <View style={styles.kpiDivider} />
              <View style={styles.kpiItem}>
                <Text style={[styles.kpiNumber, { color: '#8B5CF6' }]}>
                  {summary.totalRestoredDays}
                </Text>
                <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>Restored</Text>
              </View>
            </>
          )}
        </View>
      )}

      {/* Heatmap Grid */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Loading activity calendar...
          </Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onContentSizeChange={() => {
            scrollRef.current?.scrollToEnd({ animated: false });
          }}
          contentContainerStyle={styles.gridScrollContent}>
          {/* Weekday Row Labels (M, T, W, T, F, S, S) */}
          <View style={styles.weekdayCol}>
            {WEEKDAY_LABELS.map((label, idx) => (
              <View key={idx} style={styles.weekdayCell}>
                <Text style={[styles.weekdayText, { color: colors.textMuted }]}>
                  {label}
                </Text>
              </View>
            ))}
          </View>

          {/* Weeks Columns */}
          {weeks.map((week, wIdx) => (
            <View key={wIdx} style={styles.weekCol}>
              {week.map((day) => {
                if (day.count === -1) {
                  return <View key={day.date} style={styles.cellEmpty} />;
                }

                const isSelected = selectedDay?.date === day.date;
                const cellBg = getCellColor(day);

                return (
                  <Pressable
                    key={day.date}
                    onPress={() => setSelectedDay(day)}
                    style={({ pressed }) => [
                      styles.cell,
                      {
                        backgroundColor: cellBg,
                        borderColor: isSelected
                          ? colors.primary
                          : isDark
                          ? '#334155'
                          : '#CBD5E1',
                        borderWidth: isSelected ? 2 : 0.5,
                        transform: [{ scale: pressed ? 0.9 : 1 }],
                      },
                    ]}>
                    {day.status === 'frozen' && (
                      <Ionicons name="shield" size={9} color="#FFF" style={styles.cellIcon} />
                    )}
                    {day.status === 'restored' && (
                      <Ionicons name="sparkles" size={9} color="#FFF" style={styles.cellIcon} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Selected Day Details Inspection Box */}
      {selectedDay && selectedDay.count !== -1 && (
        <View
          style={[
            styles.detailBox,
            { backgroundColor: colors.cardSecondary, borderColor: colors.border },
          ]}>
          <View style={styles.detailHeader}>
            <View style={styles.detailDateRow}>
              <Ionicons
                name={
                  selectedDay.status === 'frozen'
                    ? 'shield-checkmark'
                    : selectedDay.status === 'restored'
                    ? 'sparkles'
                    : selectedDay.count > 0
                    ? 'flame'
                    : 'ellipse-outline'
                }
                size={16}
                color={
                  selectedDay.status === 'frozen'
                    ? '#06B6D4'
                    : selectedDay.status === 'restored'
                    ? '#8B5CF6'
                    : selectedDay.count > 0
                    ? '#10B981'
                    : colors.textMuted
                }
              />
              <Text style={[styles.detailDateText, { color: colors.text }]}>
                {formatDisplayDate(selectedDay.date)}
              </Text>
            </View>

            <View style={styles.detailPill}>
              <Text style={styles.detailPillText}>
                {selectedDay.status === 'frozen'
                  ? '🛡️ Freeze Shield'
                  : selectedDay.status === 'restored'
                  ? '✨ Streak Restored'
                  : selectedDay.count > 0
                  ? '✅ Active Study'
                  : 'Rest Day'}
              </Text>
            </View>
          </View>

          <Text style={[styles.detailSubText, { color: colors.textSecondary }]}>
            {selectedDay.status === 'frozen'
              ? 'Your streak was protected on this missed day by an active Streak Freeze.'
              : selectedDay.status === 'restored'
              ? `Recovered streak record with streak restoration.`
              : selectedDay.count > 0
              ? `${selectedDay.count} session${selectedDay.count > 1 ? 's' : ''} completed (+${selectedDay.xp} XP) • Streak: Day ${selectedDay.streak}`
              : 'No study activity recorded on this date.'}
          </Text>
        </View>
      )}

      {/* Heatmap Legend */}
      <View style={styles.legendRow}>
        <Text style={[styles.legendText, { color: colors.textMuted }]}>Less</Text>
        <View style={[styles.legendCell, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }]} />
        <View style={[styles.legendCell, { backgroundColor: isDark ? '#064E3B' : '#86EFAC' }]} />
        <View style={[styles.legendCell, { backgroundColor: isDark ? '#047857' : '#4ADE80' }]} />
        <View style={[styles.legendCell, { backgroundColor: '#10B981' }]} />
        <View style={[styles.legendCell, { backgroundColor: '#059669' }]} />
        <Text style={[styles.legendText, { color: colors.textMuted }]}>More</Text>

        <View style={styles.legendSpecialGroup}>
          <View style={[styles.legendCell, { backgroundColor: '#06B6D4' }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>Freeze</Text>
          <View style={[styles.legendCell, { backgroundColor: '#8B5CF6' }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>Restore</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 14.5,
    fontWeight: '800',
    fontFamily: Fonts.heading,
  },
  subtitle: {
    fontSize: 10.5,
    fontFamily: Fonts.body,
    marginTop: 1,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  streakBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FF5A3C',
  },
  kpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
    paddingHorizontal: 6,
    marginBottom: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  kpiItem: {
    alignItems: 'center',
    minWidth: 44,
  },
  kpiNumber: {
    fontSize: 14,
    fontWeight: '900',
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    fontFamily: Fonts.body,
  },
  kpiDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(150, 150, 150, 0.2)',
  },
  loadingBox: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 12.5,
    marginTop: 8,
    fontFamily: Fonts.body,
  },
  gridScrollContent: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingRight: 12,
  },
  weekdayCol: {
    marginRight: 6,
    justifyContent: 'space-between',
  },
  weekdayCell: {
    width: 14,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  weekdayText: {
    fontSize: 9,
    fontWeight: '700',
  },
  weekCol: {
    marginHorizontal: 2,
    justifyContent: 'space-between',
  },
  cell: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellEmpty: {
    width: 16,
    height: 16,
    marginVertical: 2,
  },
  cellIcon: {
    alignSelf: 'center',
  },
  detailBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailDateText: {
    fontSize: 13,
    fontWeight: '800',
  },
  detailPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  detailPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  detailSubText: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: Fonts.body,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 4,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '600',
    marginHorizontal: 2,
  },
  legendCell: {
    width: 11,
    height: 11,
    borderRadius: 2.5,
  },
  legendSpecialGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
});
