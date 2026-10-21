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

export interface StyledAlertConfig {
  visible: boolean;
  title: string;
  message: string;
  type?: 'error' | 'success' | 'warning' | 'info';
  buttonText?: string;
  onConfirm?: () => void;
}

interface StyledAlertModalProps {
  config: StyledAlertConfig;
  onClose: () => void;
}

export function StyledAlertModal({ config, onClose }: StyledAlertModalProps) {
  const { colors } = useAppTheme();
  const {
    visible,
    title,
    message,
    type = 'info',
    buttonText = 'Understood',
    onConfirm,
  } = config;

  if (!visible) return null;

  const handlePress = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  const getThemeProps = () => {
    switch (type) {
      case 'error':
        return {
          icon: 'alert-circle' as const,
          color: colors.error,
          bg: colors.errorBg,
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
          bg: colors.primaryBg,
        };
    }
  };

  const theme = getThemeProps();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.scrim} onPress={onClose} />
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
            <Ionicons name={theme.icon} size={28} color={theme.color} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

          {/* Message */}
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            {message}
          </Text>

          {/* Action Button */}
          <Pressable
            onPress={handlePress}
            style={({ pressed }) => [
              styles.actionBtn,
              {
                backgroundColor: theme.color === colors.error ? colors.error : colors.primary,
                shadowColor: colors.primary,
              },
              pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
            ]}>
            <Text style={styles.actionBtnText}>{buttonText}</Text>
          </Pressable>
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
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 8,
  },
  iconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
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
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 22,
  },
  actionBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  actionBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
