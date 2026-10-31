import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  BackHandler,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '@/constants/theme';
import { useAppTheme } from '@/context/ThemeContext';
import { AppIcon } from './AppIcon';
import { NativeReleaseInfo, openApkInstaller } from '@/services/nativeUpdateService';

interface NativeApkUpdateModalProps {
  visible: boolean;
  updateInfo: NativeReleaseInfo | null;
  onDismiss?: () => void;
}

export function NativeApkUpdateModal({
  visible,
  updateInfo,
  onDismiss,
}: NativeApkUpdateModalProps) {
  const { colors, isDark } = useAppTheme();
  const [opening, setOpening] = useState(false);

  // If mandatory, trap Android hardware back button
  useEffect(() => {
    if (!visible) return;

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (updateInfo?.isMandatory) {
        // Cannot dismiss mandatory native update
        return true;
      }
      if (onDismiss) {
        onDismiss();
        return true;
      }
      return false;
    });

    return () => sub.remove();
  }, [visible, updateInfo?.isMandatory, onDismiss]);

  if (!visible || !updateInfo) return null;

  const handleUpdate = async () => {
    setOpening(true);
    await openApkInstaller(updateInfo.apkDownloadUrl);
    setTimeout(() => setOpening(false), 2000);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={() => {
        if (!updateInfo.isMandatory && onDismiss) {
          onDismiss();
        }
      }}>
      <View
        style={[
          styles.backdrop,
          { backgroundColor: isDark ? 'rgba(2, 6, 23, 0.94)' : 'rgba(15, 23, 42, 0.88)' },
        ]}>
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
              styles.badge,
              updateInfo.isMandatory
                ? { backgroundColor: 'rgba(239, 68, 68, 0.14)', borderColor: 'rgba(239, 68, 68, 0.35)' }
                : { backgroundColor: 'rgba(32, 138, 239, 0.12)', borderColor: 'rgba(32, 138, 239, 0.35)' },
            ]}>
            <Ionicons
              name={updateInfo.isMandatory ? 'alert-circle' : 'sparkles'}
              size={13}
              color={updateInfo.isMandatory ? '#EF4444' : colors.primary}
            />
            <Text
              style={[
                styles.badgeText,
                { color: updateInfo.isMandatory ? '#EF4444' : colors.primary },
              ]}>
              {updateInfo.isMandatory ? 'MANDATORY NATIVE UPGRADE' : 'NEW NATIVE APK AVAILABLE'}
            </Text>
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
            <AppIcon size={56} />
          </View>

          {/* Title & Version Transition */}
          <Text style={[styles.title, { color: colors.text }]}>
            Update <Text style={{ color: colors.primary }}>AxiomByte</Text>
          </Text>

          <View style={styles.versionRow}>
            <View style={[styles.versionPill, { backgroundColor: colors.cardSecondary }]}>
              <Text style={[styles.versionPillText, { color: colors.textMuted }]}>
                Current v{updateInfo.currentVersion}
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={14} color={colors.primary} />
            <View style={[styles.versionPill, { backgroundColor: `${colors.primary}20` }]}>
              <Text style={[styles.versionPillText, { color: colors.primary, fontWeight: '700' }]}>
                Latest v{updateInfo.latestVersion}
              </Text>
            </View>
          </View>

          {/* Release Notes */}
          <View
            style={[
              styles.releaseNotesBox,
              { backgroundColor: colors.cardSecondary, borderColor: colors.borderSubtle },
            ]}>
            <View style={styles.releaseNotesHeader}>
              <Ionicons name="document-text-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.releaseNotesTitle, { color: colors.textSecondary }]}>
                What&apos;s New in this Build
              </Text>
            </View>
            <ScrollView
              style={styles.notesScroll}
              showsVerticalScrollIndicator={false}>
              <Text style={[styles.releaseNotesText, { color: colors.text }]}>
                {updateInfo.releaseNotes}
              </Text>
            </ScrollView>
          </View>

          {/* In-place upgrade guarantee notice */}
          <View style={styles.guaranteeRow}>
            <Ionicons name="shield-checkmark" size={15} color="#10B981" />
            <Text style={[styles.guaranteeText, { color: colors.textMuted }]}>
              Your login session, streaks, and local data are preserved automatically.
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actionGroup}>
            <Pressable
              onPress={handleUpdate}
              disabled={opening}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: colors.primary },
                pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
              ]}>
              {opening ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>Download & Install APK</Text>
                </>
              )}
            </Pressable>

            {!updateInfo.isMandatory && onDismiss && (
              <Pressable
                onPress={onDismiss}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  pressed && { opacity: 0.7 },
                ]}>
                <Text style={[styles.secondaryBtnText, { color: colors.textMuted }]}>
                  Remind Me Later
                </Text>
              </Pressable>
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
    maxWidth: 400,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  badgeText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  versionPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  versionPillText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '600',
  },
  releaseNotesBox: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  releaseNotesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  releaseNotesTitle: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesScroll: {
    maxHeight: 110,
  },
  releaseNotesText: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
  },
  guaranteeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 4,
    marginBottom: 20,
  },
  guaranteeText: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    lineHeight: 16,
    flex: 1,
  },
  actionGroup: {
    width: '100%',
    gap: 8,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
  },
  primaryBtnText: {
    fontFamily: Fonts.heading,
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
  },
  secondaryBtnText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
  },
});

