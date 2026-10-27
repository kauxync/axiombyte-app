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
import { useAlert } from '@/context/AlertContext';
import { StyledAlertButton } from '../StyledAlertModal';
import { Fonts } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/context/ThemeContext';
import { checkServerStatus } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

export function SettingsPage({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { colors, themeMode, setThemeMode } = useAppTheme();
  const { showAlert } = useAlert();
  const [checkingServer, setCheckingServer] = useState(false);

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

  const handleClearCache = async () => {
    Alert.alert(
      'Clear Offline Cache',
      'This will clear locally stored curriculum copies. They will be refetched automatically on your next launch.',
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
              <Text style={[styles.headerTitle, { color: colors.text }]}>Appearance & Storage</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                Visual theme, offline curriculum cache & cloud sync
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
        {/* 1. Appearance Section */}
        <AnimatedCard
          index={0}
          style={[styles.cardBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconBadge, { backgroundColor: 'rgba(129, 140, 248, 0.12)' }]}>
              <Ionicons name="color-palette-outline" size={16} color="#818CF8" />
            </View>
            <View>
              <Text style={[styles.subSectionTitle, { color: colors.text }]}>Theme & Appearance</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
                Active mode across roadmaps & Code Lab
              </Text>
            </View>
          </View>

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
                  style={({ pressed }) => [
                    styles.themeCardBtn,
                    {
                      backgroundColor: isSelected ? colors.primaryBg : colors.cardSecondary,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                    pressed && { opacity: 0.8 },
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
                  {isSelected && (
                    <View style={[styles.selectedCheckDot, { backgroundColor: colors.primary }]} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </AnimatedCard>

        {/* 2. Storage & Data Section */}
        <AnimatedCard
          index={1}
          style={[styles.cardBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconBadge, { backgroundColor: 'rgba(56, 189, 248, 0.12)' }]}>
              <Ionicons name="cloud-offline-outline" size={16} color="#38BDF8" />
            </View>
            <View>
              <Text style={[styles.subSectionTitle, { color: colors.text }]}>Storage & Offline Cache</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
                Instant zero-latency offline performance
              </Text>
            </View>
          </View>

          <Text style={[styles.policyParagraph, { color: colors.textSecondary }]}>
            AxiomByte stores all syllabus roadmaps, interactive code lessons, and Discrete Mathematics notes offline on your device for distraction-free study.
          </Text>

          <Pressable
            onPress={handleClearCache}
            style={({ pressed }) => [
              styles.outlineActionBtn,
              { borderColor: colors.border, backgroundColor: colors.cardSecondary },
              pressed && { opacity: 0.75 },
            ]}>
            <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.outlineActionBtnText, { color: colors.text }]}>
              Clear Local Curriculum Cache
            </Text>
          </Pressable>
        </AnimatedCard>

        {/* 3. Server Connectivity Section */}
        <AnimatedCard
          index={2}
          style={[styles.cardBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconBadge, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
              <Ionicons name="server-outline" size={16} color="#10B981" />
            </View>
            <View>
              <Text style={[styles.subSectionTitle, { color: colors.text }]}>Hostinger Cloud Server</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
                Remote MySQL cloud synchronization
              </Text>
            </View>
          </View>

          <Text style={[styles.policyParagraph, { color: colors.textSecondary }]}>
            Verify live connectivity with the Hostinger MySQL database cluster (axiombytedb.kauxync.in).
          </Text>

          <Pressable
            onPress={handleCheckHostingerServer}
            disabled={checkingServer}
            style={({ pressed }) => [
              styles.outlineActionBtn,
              { borderColor: colors.border, backgroundColor: colors.cardSecondary },
              pressed && { opacity: 0.75 },
            ]}>
            {checkingServer ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Ionicons name="pulse" size={16} color="#10B981" />
                <Text style={[styles.outlineActionBtnText, { color: colors.text }]}>
                  Test Hostinger Server Status
                </Text>
              </>
            )}
          </Pressable>
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
    marginBottom: 10,
  },
  sectionIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 9,
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
    gap: 7,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 13,
    position: 'relative',
  },
  themeCardBtnText: {
    fontFamily: Fonts.heading,
    fontSize: 14,
    fontWeight: '700',
  },
  selectedCheckDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    position: 'absolute',
    top: 6,
    right: 6,
  },
  policyParagraph: {
    fontFamily: Fonts.body,
    fontSize: 13,
    lineHeight: 18.5,
    marginBottom: 10,
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
});

