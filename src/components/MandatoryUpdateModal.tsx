import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  BackHandler,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '@/constants/theme';
import { useAppTheme } from '@/context/ThemeContext';
import { AppIcon } from './AppIcon';
import { downloadAndReloadUpdate } from '@/services/updates';

interface MandatoryUpdateModalProps {
  visible: boolean;
  onUpdateCompleted?: () => void;
}

/**
 * MandatoryUpdateModal enforces unskippable Over-The-Air (OTA) updates.
 * When an update is detected, the user cannot dismiss or skip:
 * - Hardware back button is trapped.
 * - No cancellation or 'Later' buttons are rendered.
 * - Downloads and reloads automatically with clear progress.
 */
export function MandatoryUpdateModal({ visible }: MandatoryUpdateModalProps) {
  const { colors, isDark } = useAppTheme();
  const [status, setStatus] = useState<'downloading' | 'reloading' | 'error'>('downloading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Pulse animation for progress bar (React 19 / React Compiler compliant)
  const [progressAnim] = useState(() => new Animated.Value(0));

  // Intercept and block Android hardware back button
  useEffect(() => {
    if (!visible) return;

    const backSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
      // Return true to prevent default back behavior (cannot exit or skip)
      return true;
    });

    return () => backSubscription.remove();
  }, [visible]);

  // Animate progress bar continuously while downloading
  useEffect(() => {
    if (!visible || status !== 'downloading') return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(progressAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: false,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [visible, status, progressAnim]);

  // Automatically start download and reload on presentation
  useEffect(() => {
    if (!visible) return;

    let isMounted = true;

    async function executeMandatoryUpdate() {
      if (!isMounted) return;
      setStatus('downloading');
      setErrorMessage('');

      const result = await downloadAndReloadUpdate();

      if (!isMounted) return;

      if (result.success) {
        setStatus('reloading');
      } else {
        setStatus('error');
        setErrorMessage(result.error || 'Failed to apply update bundle. Please check your connection.');
      }
    }

    executeMandatoryUpdate();

    return () => {
      isMounted = false;
    };
  }, [visible]);

  const handleRetry = async () => {
    setStatus('downloading');
    setErrorMessage('');
    const result = await downloadAndReloadUpdate();
    if (result.success) {
      setStatus('reloading');
    } else {
      setStatus('error');
      setErrorMessage(result.error || 'Failed to download update. Please try again.');
    }
  };

  if (!visible) return null;

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['15%', '92%'],
  });

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={() => {
        // Enforce unskippable requirement: do nothing on request close
      }}>
      <View style={[styles.backdrop, { backgroundColor: isDark ? 'rgba(2, 6, 23, 0.95)' : 'rgba(15, 23, 42, 0.90)' }]}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}>
          {/* Header Badge */}
          <View
            style={[
              styles.mandatoryBadge,
              {
                backgroundColor: 'rgba(239, 68, 68, 0.14)',
                borderColor: 'rgba(239, 68, 68, 0.35)',
              },
            ]}>
            <Ionicons name="alert-circle" size={14} color="#EF4444" />
            <Text style={styles.mandatoryBadgeText}>MANDATORY UPDATE • CANNOT SKIP</Text>
          </View>

          {/* App Icon */}
          <View
            style={[
              styles.iconWrapper,
              {
                backgroundColor: colors.primaryBg,
                borderColor: `${colors.primary}40`,
              },
            ]}>
            <AppIcon size={64} />
          </View>

          {/* Title & Branding */}
          <Text style={[styles.title, { color: colors.text }]}>
            Axiom<Text style={{ color: colors.primary }}>Byte</Text> Update
          </Text>

          <Text style={[styles.description, { color: colors.textSecondary }]}>
            A new version of AxiomByte has been detected. This update is mandatory to guarantee security, roadmap data synchronization, and uninterrupted access.
          </Text>

          {/* Progress / Status Container */}
          <View style={[styles.statusBox, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
            {status === 'downloading' && (
              <>
                <View style={styles.statusRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.statusText, { color: colors.text }]}>
                    Downloading latest bundle...
                  </Text>
                </View>

                {/* Animated progress bar */}
                <View style={[styles.progressBarTrack, { backgroundColor: colors.border }]}>
                  <Animated.View
                    style={[
                      styles.progressBarFill,
                      {
                        backgroundColor: colors.primary,
                        width: progressWidth,
                      },
                    ]}
                  />
                </View>

                <Text style={[styles.statusNote, { color: colors.textMuted }]}>
                  Please do not close the app. Reloading will happen automatically.
                </Text>
              </>
            )}

            {status === 'reloading' && (
              <View style={styles.statusRow}>
                <ActivityIndicator size="small" color="#10B981" />
                <Text style={[styles.statusText, { color: '#10B981' }]}>
                  Applying update & restarting...
                </Text>
              </View>
            )}

            {status === 'error' && (
              <>
                <View style={styles.statusRow}>
                  <Ionicons name="alert-circle" size={18} color="#EF4444" />
                  <Text style={[styles.statusText, { color: '#EF4444' }]}>
                    Download Failed
                  </Text>
                </View>
                <Text style={[styles.errorDetail, { color: colors.textMuted }]}>
                  {errorMessage}
                </Text>

                {/* Only action is retry - no skip allowed */}
                <Pressable
                  onPress={handleRetry}
                  style={({ pressed }) => [
                    styles.retryButton,
                    { backgroundColor: colors.primary },
                    pressed && { opacity: 0.85 },
                  ]}>
                  <Ionicons name="refresh" size={16} color="#FFFFFF" />
                  <Text style={styles.retryButtonText}>Retry Download & Restart</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 28,
    elevation: 12,
  },
  mandatoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  mandatoryBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#EF4444',
    letterSpacing: 0.8,
  },
  iconWrapper: {
    width: 88,
    height: 88,
    borderRadius: 26,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  description: {
    fontFamily: Fonts.body,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 6,
  },
  statusBox: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  statusText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    fontWeight: '600',
  },
  progressBarTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  statusNote: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    textAlign: 'center',
  },
  errorDetail: {
    fontFamily: Fonts.body,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 14,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    fontWeight: '700',
  },
});
