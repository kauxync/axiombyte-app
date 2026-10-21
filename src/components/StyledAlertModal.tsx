import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '@/constants/theme';
import { useAppTheme } from '@/context/ThemeContext';

export interface StyledAlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface StyledAlertConfig {
  visible: boolean;
  title: string;
  message?: string;
  type?: 'error' | 'success' | 'warning' | 'info';
  buttonText?: string;
  onConfirm?: () => void;
  buttons?: StyledAlertButton[];
}

interface StyledAlertModalProps {
  config: StyledAlertConfig;
  onClose: () => void;
}

/**
 * Auto-detects alert type based on title keywords if type was not explicitly set
 */
function resolveAlertType(
  explicitType?: 'error' | 'success' | 'warning' | 'info',
  title?: string,
  buttons?: StyledAlertButton[]
): 'error' | 'success' | 'warning' | 'info' {
  if (explicitType) return explicitType;

  const t = (title || '').toLowerCase();
  if (
    t.includes('success') ||
    t.includes('copied') ||
    t.includes('credited') ||
    t.includes('online') ||
    t.includes('cleared') ||
    t.includes('updated') ||
    t.includes('🎉') ||
    t.includes('✅') ||
    t.includes('✨')
  ) {
    return 'success';
  }

  if (
    t.includes('error') ||
    t.includes('failed') ||
    t.includes('delete') ||
    t.includes('missing') ||
    t.includes('danger')
  ) {
    return 'error';
  }

  if (
    t.includes('warning') ||
    t.includes('caution') ||
    t.includes('clear') ||
    t.includes('sign out') ||
    t.includes('logout') ||
    t.includes('remove') ||
    buttons?.some((b) => b.style === 'destructive')
  ) {
    return 'warning';
  }

  return 'info';
}

export function StyledAlertModal({ config, onClose }: StyledAlertModalProps) {
  const { colors } = useAppTheme();
  const {
    visible,
    title,
    message = '',
    type,
    buttonText = 'Understood',
    onConfirm,
    buttons,
  } = config;

  if (!visible) return null;

  const resolvedType = resolveAlertType(type, title, buttons);

  const getThemeProps = () => {
    switch (resolvedType) {
      case 'error':
        return {
          icon: 'alert-circle' as const,
          color: colors.error || '#EF4444',
          bg: 'rgba(239, 68, 68, 0.14)',
        };
      case 'success':
        return {
          icon: 'checkmark-circle' as const,
          color: '#10B981',
          bg: 'rgba(16, 185, 129, 0.14)',
        };
      case 'warning':
        return {
          icon: 'warning' as const,
          color: '#F59E0B',
          bg: 'rgba(245, 158, 11, 0.14)',
        };
      case 'info':
      default:
        return {
          icon: 'information-circle' as const,
          color: colors.primary,
          bg: colors.primaryBg || 'rgba(99, 102, 241, 0.14)',
        };
    }
  };

  const theme = getThemeProps();

  const handleSingleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  const handleButtonPress = (btn: StyledAlertButton) => {
    if (btn.onPress) {
      btn.onPress();
    }
    onClose();
  };

  // Determine button rendering layout:
  // 1. If explicit buttons array provided:
  //    - 2 buttons: side-by-side row
  //    - 3+ buttons: vertical stack
  // 2. If no buttons array, render single primary button
  const hasButtonsArray = Array.isArray(buttons) && buttons.length > 0;
  const isTwoButtons = hasButtonsArray && buttons.length === 2;
  const isMultiButtons = hasButtonsArray && buttons.length > 2;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={styles.scrim}
          onPress={() => {
            // Only dismiss on backdrop tap if it's not a destructive confirmation
            const hasDestructive = buttons?.some((b) => b.style === 'destructive');
            if (!hasDestructive) {
              onClose();
            }
          }}
        />
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}>
          {/* Icon Badge */}
          <View style={[styles.iconBadge, { backgroundColor: theme.bg }]}>
            <Ionicons name={theme.icon} size={30} color={theme.color} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

          {/* Message */}
          {message ? (
            <Text style={[styles.message, { color: colors.textSecondary }]}>
              {message}
            </Text>
          ) : null}

          {/* Action Buttons */}
          {hasButtonsArray ? (
            isTwoButtons ? (
              <View style={styles.twoButtonRow}>
                {buttons.map((btn, idx) => {
                  const isCancel = btn.style === 'cancel';
                  const isDestructive = btn.style === 'destructive';

                  let bg = colors.primary;
                  let textColor = '#FFFFFF';
                  let border = colors.primary;

                  if (isCancel) {
                    bg = colors.cardSecondary;
                    textColor = colors.text;
                    border = colors.border;
                  } else if (isDestructive) {
                    bg = colors.error || '#EF4444';
                    textColor = '#FFFFFF';
                    border = colors.error || '#EF4444';
                  }

                  return (
                    <Pressable
                      key={idx}
                      onPress={() => handleButtonPress(btn)}
                      style={({ pressed }) => [
                        styles.halfBtn,
                        {
                          backgroundColor: bg,
                          borderColor: border,
                        },
                        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                      ]}>
                      <Text
                        style={[
                          styles.btnText,
                          { color: textColor },
                          isCancel && { fontWeight: '600' },
                        ]}
                        numberOfLines={1}>
                        {btn.text}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : isMultiButtons ? (
              <View style={styles.multiButtonCol}>
                {buttons.map((btn, idx) => {
                  const isCancel = btn.style === 'cancel';
                  const isDestructive = btn.style === 'destructive';

                  let bg = colors.primary;
                  let textColor = '#FFFFFF';
                  let border = colors.primary;

                  if (isCancel) {
                    bg = colors.cardSecondary;
                    textColor = colors.text;
                    border = colors.border;
                  } else if (isDestructive) {
                    bg = colors.error || '#EF4444';
                    textColor = '#FFFFFF';
                    border = colors.error || '#EF4444';
                  }

                  return (
                    <Pressable
                      key={idx}
                      onPress={() => handleButtonPress(btn)}
                      style={({ pressed }) => [
                        styles.fullBtn,
                        {
                          backgroundColor: bg,
                          borderColor: border,
                        },
                        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                      ]}>
                      <Text
                        style={[
                          styles.btnText,
                          { color: textColor },
                          isCancel && { fontWeight: '600' },
                        ]}>
                        {btn.text}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              // 1 button in array
              <Pressable
                onPress={() => handleButtonPress(buttons[0])}
                style={({ pressed }) => [
                  styles.fullBtn,
                  {
                    backgroundColor:
                      buttons[0].style === 'destructive'
                        ? colors.error || '#EF4444'
                        : colors.primary,
                    borderColor:
                      buttons[0].style === 'destructive'
                        ? colors.error || '#EF4444'
                        : colors.primary,
                  },
                  pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
                ]}>
                <Text style={[styles.btnText, { color: '#FFFFFF' }]}>
                  {buttons[0].text}
                </Text>
              </Pressable>
            )
          ) : (
            // Default single button
            <Pressable
              onPress={handleSingleConfirm}
              style={({ pressed }) => [
                styles.fullBtn,
                {
                  backgroundColor:
                    resolvedType === 'error'
                      ? colors.error || '#EF4444'
                      : colors.primary,
                  borderColor:
                    resolvedType === 'error'
                      ? colors.error || '#EF4444'
                      : colors.primary,
                },
                pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
              ]}>
              <Text style={[styles.btnText, { color: '#FFFFFF' }]}>
                {buttonText}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
  },
  card: {
    width: Math.min(width - 48, 380),
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.35,
    shadowRadius: 28,
    elevation: 10,
  },
  iconBadge: {
    width: 62,
    height: 62,
    borderRadius: 31,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  message: {
    fontFamily: Fonts.body,
    fontSize: 14.5,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 22,
  },
  twoButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  halfBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  multiButtonCol: {
    width: '100%',
    gap: 8,
  },
  fullBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  btnText: {
    fontFamily: Fonts.heading,
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
