import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '@/constants/theme';
import { useAppTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';

interface DeleteAccountModalProps {
  visible: boolean;
  onClose: () => void;
}

export function DeleteAccountModal({ visible, onClose }: DeleteAccountModalProps) {
  const { colors, isDark } = useAppTheme();
  const { user, deleteAccount } = useAuth();

  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleClose = () => {
    if (isDeleting) return;
    setIsConfirmed(false);
    setErrorMessage(null);
    onClose();
  };

  const handleExecuteDelete = async () => {
    if (!isConfirmed || isDeleting) return;

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const res = await deleteAccount();
      if (!res.success) {
        setErrorMessage(res.error || 'Could not complete account deletion. Please try again.');
        setIsDeleting(false);
      } else {
        // Successful deletion will trigger auth state reset in AuthContext
        setIsDeleting(false);
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'A network error occurred while deleting your account.');
      setIsDeleting(false);
    }
  };

  if (!visible) return null;

  const inrBalance = user ? (user.coins / 100).toFixed(2) : '0.00';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}>
      <View style={styles.backdropOverlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
          disabled={isDeleting}
        />

        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: colors.card,
              borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.25)',
            },
          ]}>
          {/* Top Danger Accent Bar */}
          <View style={styles.dangerTopAccent} />

          {/* Modal Header */}
          <View style={styles.modalHeaderRow}>
            <View style={styles.iconTitleGroup}>
              <View
                style={[
                  styles.dangerIconBadge,
                  { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.16)' : 'rgba(239, 68, 68, 0.1)' },
                ]}>
                <Ionicons name="trash" size={20} color="#EF4444" />
              </View>
              <View style={styles.titleTextContainer}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Delete Account
                </Text>
                <Text style={[styles.modalSubtitle, { color: '#EF4444' }]}>
                  Irreversible Academic Data Erasure
                </Text>
              </View>
            </View>

            <Pressable
              onPress={handleClose}
              disabled={isDeleting}
              hitSlop={12}
              style={({ pressed }) => [
                styles.closeIconBtn,
                { backgroundColor: colors.cardSecondary, borderColor: colors.borderSubtle },
                pressed && { opacity: 0.7 },
              ]}>
              <Ionicons name="close" size={17} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={styles.scrollContent}>
            {/* Warning Callout */}
            <View
              style={[
                styles.warningCalloutBox,
                {
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.10)' : 'rgba(239, 68, 68, 0.06)',
                  borderColor: isDark ? 'rgba(239, 68, 68, 0.28)' : 'rgba(239, 68, 68, 0.18)',
                },
              ]}>
              <Ionicons name="warning-outline" size={18} color="#EF4444" style={{ marginTop: 2 }} />
              <Text style={[styles.warningCalloutText, { color: colors.text }]}>
                This action is <Text style={styles.boldRedText}>permanent</Text>. Your account, credentials, and synchronized cloud backups will be wiped under DPDP & GDPR compliance.
              </Text>
            </View>

            {/* What will be deleted breakdown */}
            <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>
              DATA TO BE PERMANENTLY ERASED
            </Text>

            <View style={[styles.consequenceCard, { backgroundColor: colors.cardSecondary, borderColor: colors.borderSubtle }]}>
              {/* Item 1: Academic Progress */}
              <View style={[styles.consequenceRow, { borderBottomColor: colors.borderSubtle }]}>
                <View style={[styles.consequenceIconBox, { backgroundColor: 'rgba(99, 102, 241, 0.14)' }]}>
                  <Ionicons name="school-outline" size={16} color="#818CF8" />
                </View>
                <View style={styles.consequenceTextCol}>
                  <Text style={[styles.consequenceTitle, { color: colors.text }]}>Academic Progress & XP</Text>
                  <Text style={[styles.consequenceSub, { color: colors.textSecondary }]}>
                    {user?.xp ?? 0} Study XP, roadmap checkpoints, and semester records
                  </Text>
                </View>
              </View>

              {/* Item 2: Axiom Wealth & Balance */}
              <View style={[styles.consequenceRow, { borderBottomColor: colors.borderSubtle }]}>
                <View style={[styles.consequenceIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.14)' }]}>
                  <Ionicons name="sparkles-outline" size={16} color="#F59E0B" />
                </View>
                <View style={styles.consequenceTextCol}>
                  <Text style={[styles.consequenceTitle, { color: colors.text }]}>Axiom Coins & Grants</Text>
                  <Text style={[styles.consequenceSub, { color: colors.textSecondary }]}>
                    {user?.coins ?? 0} coins balance (≈ ₹{inrBalance} INR) will be forfeited
                  </Text>
                </View>
              </View>

              {/* Item 3: Study Streak */}
              <View style={styles.consequenceRow}>
                <View style={[styles.consequenceIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.14)' }]}>
                  <Ionicons name="flame-outline" size={16} color="#EF4444" />
                </View>
                <View style={styles.consequenceTextCol}>
                  <Text style={[styles.consequenceTitle, { color: colors.text }]}>Study Streak & Badges</Text>
                  <Text style={[styles.consequenceSub, { color: colors.textSecondary }]}>
                    Active daily streaks, calendar history, and streak freezes
                  </Text>
                </View>
              </View>
            </View>

            {/* Error Message Notice if any */}
            {errorMessage ? (
              <View style={[styles.errorNoticeBox, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                <Ionicons name="alert-circle" size={16} color="#EF4444" />
                <Text style={styles.errorNoticeText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Confirmation Checkbox Guard */}
            <Pressable
              onPress={() => setIsConfirmed((prev) => !prev)}
              disabled={isDeleting}
              style={({ pressed }) => [
                styles.confirmCheckRow,
                {
                  backgroundColor: isConfirmed
                    ? isDark
                      ? 'rgba(239, 68, 68, 0.12)'
                      : 'rgba(239, 68, 68, 0.08)'
                    : colors.cardSecondary,
                  borderColor: isConfirmed ? '#EF4444' : colors.border,
                },
                pressed && { opacity: 0.8 },
              ]}>
              <View
                style={[
                  styles.checkboxBox,
                  {
                    backgroundColor: isConfirmed ? '#EF4444' : 'transparent',
                    borderColor: isConfirmed ? '#EF4444' : colors.textMuted,
                  },
                ]}>
                {isConfirmed && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
              </View>
              <Text style={[styles.confirmCheckLabel, { color: colors.text }]}>
                I understand this cannot be undone and permanently consent to erasing my account.
              </Text>
            </Pressable>

            {/* Action Buttons */}
            <View style={styles.actionButtonGroup}>
              {/* Primary Destructive Delete Button */}
              <Pressable
                onPress={handleExecuteDelete}
                disabled={!isConfirmed || isDeleting}
                style={({ pressed }) => [
                  styles.deleteSubmitBtn,
                  {
                    backgroundColor: isConfirmed ? '#EF4444' : isDark ? '#334155' : '#CBD5E1',
                    opacity: !isConfirmed || isDeleting ? 0.6 : 1,
                  },
                  pressed && isConfirmed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
                ]}>
                {isDeleting ? (
                  <View style={styles.btnContentRow}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.deleteSubmitBtnText}>Erasing Academic Records...</Text>
                  </View>
                ) : (
                  <View style={styles.btnContentRow}>
                    <Ionicons name="trash-bin-outline" size={17} color="#FFFFFF" />
                    <Text style={styles.deleteSubmitBtnText}>Permanently Delete Account</Text>
                  </View>
                )}
              </Pressable>

              {/* Safe Cancel Button */}
              <Pressable
                onPress={handleClose}
                disabled={isDeleting}
                style={({ pressed }) => [
                  styles.cancelBtn,
                  {
                    backgroundColor: colors.cardSecondary,
                    borderColor: colors.border,
                  },
                  pressed && { opacity: 0.75 },
                ]}>
                <Text style={[styles.cancelBtnText, { color: colors.text }]}>
                  Keep My Account
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '92%',
    borderRadius: 24,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 14,
  },
  dangerTopAccent: {
    height: 3.5,
    backgroundColor: '#EF4444',
    width: '100%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(239, 68, 68, 0.12)',
  },
  iconTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  dangerIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleTextContainer: {
    flex: 1,
  },
  modalTitle: {
    fontFamily: Fonts.heading,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  closeIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  warningCalloutBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  warningCalloutText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  boldRedText: {
    fontFamily: Fonts.heading,
    fontWeight: '700',
    color: '#EF4444',
  },
  sectionHeading: {
    fontFamily: Fonts.headingDemiBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  consequenceCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  consequenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  consequenceIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  consequenceTextCol: {
    flex: 1,
  },
  consequenceTitle: {
    fontFamily: Fonts.heading,
    fontSize: 13.5,
    fontWeight: '700',
  },
  consequenceSub: {
    fontFamily: Fonts.body,
    fontSize: 12,
    marginTop: 1,
  },
  errorNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    marginBottom: 14,
  },
  errorNoticeText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12.5,
    color: '#EF4444',
    flex: 1,
  },
  confirmCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 18,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmCheckLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12.5,
    lineHeight: 17,
    flex: 1,
  },
  actionButtonGroup: {
    gap: 10,
  },
  deleteSubmitBtn: {
    minHeight: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  btnContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteSubmitBtnText: {
    fontFamily: Fonts.heading,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelBtn: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  cancelBtnText: {
    fontFamily: Fonts.headingMedium,
    fontSize: 13.5,
  },
});

