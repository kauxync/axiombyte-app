import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { fetchLeaderboardApi, LeaderboardData } from '@/services/api';
import { Fonts } from '@/constants/theme';

interface LeaderboardViewProps {
  onGoBack?: () => void;
  canGoBack?: boolean;
}

export function LeaderboardView({ onGoBack, canGoBack }: LeaderboardViewProps) {
  const { colors, isDark } = useAppTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isWide = width >= 768;

  const loadLeaderboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await fetchLeaderboardApi({
        userId: user?.id,
        limit: 25,
        offset: 0,
      });

      if (res.success && res.data) {
        setLeaderboardData(res.data);
      } else {
        setError(res.message || 'Could not load leaderboard.');
      }
    } catch (e: any) {
      setError(e?.message || 'Could not load leaderboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    let isCancelled = false;
    (async () => {
      try {
        const res = await fetchLeaderboardApi({
          userId: user?.id,
          limit: 25,
          offset: 0,
        });
        if (isCancelled) return;
        if (res.success && res.data) {
          setLeaderboardData(res.data);
        } else {
          setError(res.message || 'Could not load leaderboard.');
        }
      } catch (e: any) {
        if (!isCancelled) setError(e?.message || 'Could not load leaderboard.');
      } finally {
        if (!isCancelled) setLoading(false);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [user]);

  const handleLoadMore = async () => {
    if (!leaderboardData || loadingMore || !leaderboardData.hasMore) return;
    setLoadingMore(true);

    try {
      const nextOffset = leaderboardData.offset + leaderboardData.limit;
      const res = await fetchLeaderboardApi({
        userId: user?.id,
        limit: 25,
        offset: nextOffset,
      });

      if (res.success && res.data) {
        setLeaderboardData((prev) => {
          if (!prev) return res.data || null;
          return {
            ...res.data!,
            entries: [...prev.entries, ...res.data!.entries],
          };
        });
      }
    } catch {
      // Ignore load more failure
    } finally {
      setLoadingMore(false);
    }
  };

  const entries = leaderboardData?.entries || [];
  const topThree = entries.slice(0, 3);
  const remainingEntries = entries.slice(3);
  const currentUser =
    leaderboardData?.currentUser ||
    entries.find(
      (e) =>
        (user?.id && e.userId === user.id) ||
        (user?.username && e.username.toLowerCase() === user.username.toLowerCase()) ||
        Boolean(e.isCurrentUser)
    ) ||
    null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top App Bar */}
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 12 : 8),
          },
        ]}>
        <View style={styles.headerLeft}>
          <View style={[styles.trophyIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
            <Ionicons name="trophy" size={20} color="#F59E0B" />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Leaderboard</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
              Top Scholars & XP Rankings
            </Text>
          </View>
        </View>

        {currentUser && (
          <View style={[styles.userRankPill, { backgroundColor: 'rgba(32, 138, 239, 0.12)', borderColor: 'rgba(32, 138, 239, 0.3)' }]}>
            <Ionicons name="ribbon-outline" size={14} color="#208AEF" />
            <Text style={[styles.userRankPillText, { color: '#208AEF' }]}>
              Rank #{currentUser.rank}
            </Text>
          </View>
        )}
      </View>

      {/* Main Content Area */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Loading global rankings...
          </Text>
        </View>
      ) : error && entries.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Unable to load rankings</Text>
          <Text style={[styles.errorDesc, { color: colors.textMuted }]}>{error}</Text>
          <Pressable
            onPress={() => loadLeaderboard()}
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isWide && styles.wideContainer,
            { paddingBottom: insets.bottom + 100 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadLeaderboard(true)}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}>
          {/* Rules / Tie-breaking note */}
          <View style={[styles.infoBanner, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
            <Ionicons name="sparkles" size={14} color="#F59E0B" />
            <Text style={[styles.infoBannerText, { color: colors.textSecondary }]}>
              Rankings are based on total verified study XP and streak mastery. Tie-breaking prioritizes longest streak.
            </Text>
          </View>

          {entries.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
                <Ionicons name="trophy-outline" size={48} color="#F59E0B" />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Scholars Ranked Yet</Text>
              <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
                Complete study sessions, solve problems, and maintain daily streaks to climb to the top of the global leaderboard!
              </Text>
            </View>
          ) : (
            <>
              {/* Top 3 Podium Section */}
              {topThree.length > 0 && (
                <View style={styles.podiumSection}>
              {/* 2nd Place */}
              {topThree[1] && (
                <View style={[styles.podiumCol, styles.podiumSecond]}>
                  <View style={styles.podiumCrown}>
                    <Text style={styles.podiumMedal}>🥈</Text>
                  </View>
                  <View style={[styles.podiumAvatarBox, { borderColor: '#94A3B8' }]}>
                    {topThree[1].avatarUrl ? (
                      <Image source={{ uri: topThree[1].avatarUrl }} style={styles.podiumAvatar} />
                    ) : (
                      <View style={[styles.podiumAvatarFallback, { backgroundColor: '#334155' }]}>
                        <Text style={styles.fallbackLetter}>{topThree[1].name.charAt(0)}</Text>
                      </View>
                    )}
                  </View>
                  <Text numberOfLines={1} style={[styles.podiumName, { color: colors.text }]}>
                    {topThree[1].name}
                  </Text>
                  <View style={styles.podiumXpPill}>
                    <Text style={styles.podiumXpText}>{topThree[1].xp} XP</Text>
                  </View>
                  <View style={[styles.podiumPedestal, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0', height: 80 }]}>
                    <Text style={[styles.pedestalNumber, { color: '#94A3B8' }]}>2</Text>
                  </View>
                </View>
              )}

              {/* 1st Place (Center, tallest) */}
              {topThree[0] && (
                <View style={[styles.podiumCol, styles.podiumFirst]}>
                  <View style={styles.podiumCrown}>
                    <Text style={styles.podiumMedal}>👑</Text>
                  </View>
                  <View style={[styles.podiumAvatarBox, { borderColor: '#F59E0B', borderWidth: 2.5 }]}>
                    {topThree[0].avatarUrl ? (
                      <Image source={{ uri: topThree[0].avatarUrl }} style={styles.podiumAvatar} />
                    ) : (
                      <View style={[styles.podiumAvatarFallback, { backgroundColor: '#78350F' }]}>
                        <Text style={[styles.fallbackLetter, { color: '#FDE68A' }]}>
                          {topThree[0].name.charAt(0)}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text numberOfLines={1} style={[styles.podiumName, { color: colors.text, fontWeight: '800' }]}>
                    {topThree[0].name}
                  </Text>
                  <View style={[styles.podiumXpPill, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                    <Text style={[styles.podiumXpText, { color: '#F59E0B' }]}>{topThree[0].xp} XP</Text>
                  </View>
                  <View style={[styles.podiumPedestal, { backgroundColor: isDark ? '#2E2211' : '#FEF3C7', height: 105, borderColor: '#F59E0B' }]}>
                    <Text style={[styles.pedestalNumber, { color: '#F59E0B' }]}>1</Text>
                  </View>
                </View>
              )}

              {/* 3rd Place */}
              {topThree[2] && (
                <View style={[styles.podiumCol, styles.podiumThird]}>
                  <View style={styles.podiumCrown}>
                    <Text style={styles.podiumMedal}>🥉</Text>
                  </View>
                  <View style={[styles.podiumAvatarBox, { borderColor: '#CD7F32' }]}>
                    {topThree[2].avatarUrl ? (
                      <Image source={{ uri: topThree[2].avatarUrl }} style={styles.podiumAvatar} />
                    ) : (
                      <View style={[styles.podiumAvatarFallback, { backgroundColor: '#451A03' }]}>
                        <Text style={styles.fallbackLetter}>{topThree[2].name.charAt(0)}</Text>
                      </View>
                    )}
                  </View>
                  <Text numberOfLines={1} style={[styles.podiumName, { color: colors.text }]}>
                    {topThree[2].name}
                  </Text>
                  <View style={styles.podiumXpPill}>
                    <Text style={styles.podiumXpText}>{topThree[2].xp} XP</Text>
                  </View>
                  <View style={[styles.podiumPedestal, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0', height: 65 }]}>
                    <Text style={[styles.pedestalNumber, { color: '#CD7F32' }]}>3</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* List Section (4th onwards) */}
          <View style={styles.listSection}>
            <Text style={[styles.listHeaderTitle, { color: colors.textMuted }]}>
              ALL SCHOLARS ({leaderboardData?.totalUsers || entries.length})
            </Text>

            {remainingEntries.map((item) => {
              const isSelf = Boolean(
                item.isCurrentUser ||
                (user?.id && item.userId === user.id) ||
                (user?.username && item.username.toLowerCase() === user.username.toLowerCase())
              );

              return (
                <View
                  key={item.userId}
                  style={[
                    styles.rankRow,
                    {
                      backgroundColor: isSelf
                        ? isDark
                          ? 'rgba(32, 138, 239, 0.15)'
                          : 'rgba(32, 138, 239, 0.08)'
                        : colors.card,
                      borderColor: isSelf ? '#208AEF' : colors.border,
                      borderWidth: isSelf ? 1.5 : 1,
                    },
                  ]}>
                  {/* Rank Badge */}
                  <View style={styles.rankPill}>
                    <Text style={[styles.rankNumber, { color: isSelf ? '#208AEF' : colors.textMuted }]}>
                      #{item.rank}
                    </Text>
                  </View>

                  {/* Avatar */}
                  <View style={styles.avatarBox}>
                    {item.avatarUrl ? (
                      <Image source={{ uri: item.avatarUrl }} style={styles.avatarImage} />
                    ) : (
                      <View style={[styles.avatarFallback, { backgroundColor: isSelf ? '#208AEF' : colors.cardSecondary }]}>
                        <Text style={[styles.avatarFallbackLetter, { color: isSelf ? '#FFF' : colors.text }]}>
                          {item.name.charAt(0)}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* User Info */}
                  <View style={styles.userInfoCol}>
                    <View style={styles.userNameRow}>
                      <Text numberOfLines={1} style={[styles.rowDisplayName, { color: colors.text }]}>
                        {item.name}
                      </Text>
                      {isSelf && (
                        <View style={styles.youBadge}>
                          <Text style={styles.youBadgeText}>YOU</Text>
                        </View>
                      )}
                    </View>
                    <Text numberOfLines={1} style={[styles.rowUsername, { color: colors.textMuted }]}>
                      @{item.username} • {item.university || 'Scholar'}
                    </Text>
                  </View>

                  {/* XP & Streak stats */}
                  <View style={styles.rowStatsCol}>
                    <View style={[styles.xpBadge, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                      <Ionicons name="sparkles" size={12} color="#F59E0B" />
                      <Text style={styles.xpBadgeText}>{item.xp} XP</Text>
                    </View>
                    {item.currentStreak > 0 && (
                      <View style={styles.streakBadge}>
                        <Ionicons name="flame" size={12} color="#FF5A3C" />
                        <Text style={styles.streakBadgeText}>{item.currentStreak}d</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}

            {/* Pagination Load More Button */}
            {leaderboardData?.hasMore && (
              <Pressable
                onPress={handleLoadMore}
                disabled={loadingMore}
                style={({ pressed }) => [
                  styles.loadMoreBtn,
                  { backgroundColor: colors.cardSecondary, borderColor: colors.border },
                  pressed && { opacity: 0.8 },
                ]}>
                {loadingMore ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Text style={[styles.loadMoreText, { color: colors.primary }]}>
                      Load Next 25 Scholars
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={colors.primary} />
                  </>
                )}
              </Pressable>
            )}
          </View>
        </>
      )}
        </ScrollView>
      )}

      {/* Floating Bottom Card for Current User */}
      {currentUser && (
        <View
          style={[
            styles.floatingBottomBar,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}>
          <View style={styles.floatingLeft}>
            <View style={[styles.floatingRankBadge, { backgroundColor: '#208AEF' }]}>
              <Text style={styles.floatingRankText}>#{currentUser.rank}</Text>
            </View>
            <View style={styles.floatingUserInfo}>
              <Text style={[styles.floatingName, { color: colors.text }]}>Your Standing</Text>
              <Text style={[styles.floatingSub, { color: colors.textMuted }]}>
                Top {Math.max(1, Math.round((currentUser.rank / Math.max(1, leaderboardData?.totalUsers || 1)) * 100))}% of scholars
              </Text>
            </View>
          </View>

          <View style={styles.floatingRight}>
            <View style={[styles.floatingXpBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
              <Ionicons name="sparkles" size={13} color="#F59E0B" />
              <Text style={styles.floatingXpText}>{currentUser.xp} XP</Text>
            </View>
            <View style={[styles.floatingStreakBox, { backgroundColor: 'rgba(255, 90, 60, 0.15)' }]}>
              <Ionicons name="flame" size={13} color="#FF5A3C" />
              <Text style={styles.floatingStreakText}>{currentUser.currentStreak}d</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    padding: 6,
    marginLeft: -6,
  },
  trophyIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: Fonts.heading,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: Fonts.body,
  },
  userRankPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  userRankPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: Fonts.heading,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 13.5,
    lineHeight: 20,
    fontFamily: Fonts.body,
    textAlign: 'center',
    maxWidth: 320,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: Fonts.body,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 14,
  },
  errorDesc: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#FFF',
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  wideContainer: {
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
    fontFamily: Fonts.body,
  },
  podiumSection: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  podiumCol: {
    flex: 1,
    alignItems: 'center',
  },
  podiumFirst: {
    transform: [{ translateY: -10 }],
  },
  podiumSecond: {},
  podiumThird: {},
  podiumCrown: {
    marginBottom: 4,
  },
  podiumMedal: {
    fontSize: 22,
  },
  podiumAvatarBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  podiumAvatar: {
    width: '100%',
    height: '100%',
  },
  podiumAvatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackLetter: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
  },
  podiumName: {
    fontSize: 12.5,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
    maxWidth: 90,
  },
  podiumXpPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 8,
  },
  podiumXpText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F59E0B',
  },
  podiumPedestal: {
    width: '100%',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  pedestalNumber: {
    fontSize: 28,
    fontWeight: '900',
  },
  listSection: {
    marginTop: 4,
  },
  listHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 8,
    gap: 12,
  },
  rankPill: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNumber: {
    fontSize: 14,
    fontWeight: '800',
  },
  avatarBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackLetter: {
    fontSize: 16,
    fontWeight: '700',
  },
  userInfoCol: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowDisplayName: {
    fontSize: 14,
    fontWeight: '700',
    maxWidth: 160,
  },
  youBadge: {
    backgroundColor: '#208AEF',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  youBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFF',
  },
  rowUsername: {
    fontSize: 11.5,
    marginTop: 1,
  },
  rowStatsCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  xpBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#F59E0B',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  streakBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF5A3C',
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    gap: 6,
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: '700',
  },
  floatingBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  floatingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  floatingRankBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  floatingRankText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 13,
  },
  floatingUserInfo: {},
  floatingName: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  floatingSub: {
    fontSize: 11,
  },
  floatingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  floatingXpBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  floatingXpText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F59E0B',
  },
  floatingStreakBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  floatingStreakText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FF5A3C',
  },
});
