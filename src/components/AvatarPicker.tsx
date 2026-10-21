import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '@/constants/theme';
import { useAppTheme } from '@/context/ThemeContext';
import { uploadFileToHostinger } from '@/services/api';
import { useAlert } from '@/context/AlertContext';

export interface AvatarOption {
  id: string;
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  bgColor: string;
  iconColor: string;
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: 'avatar_1', label: 'C Coder', iconName: 'terminal', bgColor: '#1E293B', iconColor: '#38BDF8' },
  { id: 'avatar_2', label: 'Math Theorist', iconName: 'calculator', bgColor: '#4C1D95', iconColor: '#C084FC' },
  { id: 'avatar_3', label: 'Systems Hacker', iconName: 'hardware-chip', bgColor: '#064E3B', iconColor: '#34D399' },
  { id: 'avatar_4', label: 'Logic Explorer', iconName: 'git-network', bgColor: '#78350F', iconColor: '#FBBF24' },
  { id: 'avatar_5', label: 'Pointer Master', iconName: 'code-slash', bgColor: '#831843', iconColor: '#F472B6' },
  { id: 'avatar_6', label: 'Graph Walker', iconName: 'planet', bgColor: '#1E3A8A', iconColor: '#60A5FA' },
];

export function AvatarIcon({
  avatarId,
  size = 48,
}: {
  avatarId?: string;
  size?: number;
}) {
  if (!avatarId) {
    return (
      <View
        style={[
          styles.avatarCircle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: '#334155',
          },
        ]}>
        <Ionicons name="person-outline" size={Math.round(size * 0.5)} color="#94A3B8" />
      </View>
    );
  }

  const isCustomUrl =
    avatarId.startsWith('http://') ||
    avatarId.startsWith('https://') ||
    avatarId.startsWith('file://') ||
    avatarId.startsWith('data:');

  if (isCustomUrl) {
    return (
      <Image
        source={{ uri: avatarId }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#1E293B',
        }}
        contentFit="cover"
        transition={200}
      />
    );
  }

  const opt = AVATAR_OPTIONS.find((a) => a.id === avatarId) || AVATAR_OPTIONS[0];
  const iconSize = Math.round(size * 0.55);

  return (
    <View
      style={[
        styles.avatarCircle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: opt.bgColor,
        },
      ]}>
      <Ionicons name={opt.iconName} size={iconSize} color={opt.iconColor} />
    </View>
  );
}

export function AvatarPicker({
  selectedId,
  onSelect,
  userId,
  onShowAlert,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
  userId?: string;
  onShowAlert?: (title: string, message: string, type: 'error' | 'success' | 'warning' | 'info') => void;
}) {
  const { colors } = useAppTheme();
  const { showAlert: contextShowAlert } = useAlert();
  const [uploading, setUploading] = useState(false);

  const showAlert = (title: string, message: string, type: 'error' | 'success' | 'warning' | 'info' = 'info') => {
    if (onShowAlert) {
      onShowAlert(title, message, type);
    } else {
      contextShowAlert(title, message, undefined, { type });
    }
  };

  const isCustomPhoto =
    !!selectedId &&
    (selectedId.startsWith('http://') ||
      selectedId.startsWith('https://') ||
      selectedId.startsWith('file://') ||
      selectedId.startsWith('data:'));

  const handlePickAndUploadPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showAlert(
          'Permission Required',
          'Please allow access to your photo library to upload your profile picture.',
          'warning'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const pickedUri = asset.uri;
        const mimeType = asset.mimeType || 'image/jpeg';
        const base64Payload = asset.base64 ? `data:${mimeType};base64,${asset.base64}` : undefined;

        setUploading(true);

        const uploadRes = await uploadFileToHostinger(
          {
            uri: pickedUri,
            base64: base64Payload,
            name: asset.fileName || `avatar_${Date.now()}.jpg`,
            type: mimeType,
          },
          'avatar',
          userId
        );

        const serverUrl = uploadRes.data?.publicUrl || (uploadRes.data as any)?.url;

        if (uploadRes.success && serverUrl) {
          onSelect(serverUrl);
          showAlert(
            'Photo Uploaded',
            'Your profile picture was uploaded and stored on the server successfully.',
            'success'
          );
        } else {
          showAlert(
            'Upload Failed',
            uploadRes.message || 'Could not upload photo to server. Please check your network and retry.',
            'error'
          );
        }
      }
    } catch (err: any) {
      showAlert('Upload Error', err?.message || 'Could not pick or upload photo.', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Custom Photo Upload Card */}
      <Pressable
        onPress={handlePickAndUploadPhoto}
        disabled={uploading}
        style={[
          styles.uploadCard,
          {
            backgroundColor: colors.card,
            borderColor: isCustomPhoto ? colors.primary : colors.border,
          },
          isCustomPhoto && { backgroundColor: colors.primaryBg },
        ]}>
        <View style={styles.uploadCardInner}>
          {uploading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : isCustomPhoto ? (
            <Image
              source={{ uri: selectedId }}
              style={styles.customThumb}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.uploadIconBadge, { backgroundColor: colors.primaryBg }]}>
              <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
            </View>
          )}

          <View style={styles.uploadTextContainer}>
            <Text style={[styles.uploadTitle, { color: colors.text }]}>
              {uploading
                ? 'Uploading photo...'
                : isCustomPhoto
                ? 'Custom Photo Uploaded'
                : 'Upload Custom Photo'}
            </Text>
            <Text style={[styles.uploadSubtitle, { color: colors.textMuted }]}>
              {isCustomPhoto
                ? 'Saved to your profile picture'
                : 'Tap to pick JPG or PNG from gallery'}
            </Text>
          </View>

          <View
            style={[
              styles.uploadActionBtn,
              { backgroundColor: isCustomPhoto ? colors.primary : colors.cardSecondary },
            ]}>
            <Ionicons
              name={isCustomPhoto ? 'checkmark' : 'camera-outline'}
              size={16}
              color={isCustomPhoto ? '#0F172A' : colors.text}
            />
          </View>
        </View>
      </Pressable>

      <Text style={[styles.sectionDivider, { color: colors.textMuted }]}>OR CHOOSE AN AVATAR</Text>

      {/* Preset Badge Avatars Grid */}
      <View style={styles.grid}>
        {AVATAR_OPTIONS.map((opt) => {
          const isSelected = selectedId === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => onSelect(opt.id)}
              style={[
                styles.avatarButton,
                { borderColor: colors.border },
                isSelected && [
                  styles.avatarButtonSelected,
                  {
                    borderColor: colors.primary,
                    backgroundColor: colors.primaryBg,
                  },
                ],
              ]}>
              <View
                style={[
                  styles.avatarCircle,
                  {
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    backgroundColor: opt.bgColor,
                  },
                ]}>
                <Ionicons name={opt.iconName} size={26} color={opt.iconColor} />
              </View>
              <Text
                style={[
                  styles.avatarLabel,
                  { color: colors.textSecondary },
                  isSelected && [
                    styles.avatarLabelSelected,
                    { color: colors.primary },
                  ],
                ]}
                numberOfLines={1}>
                {opt.label}
              </Text>
              {isSelected && (
                <View style={[styles.checkBadge, { backgroundColor: colors.card }]}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  uploadCard: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  uploadCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  uploadIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customThumb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  uploadTextContainer: {
    flex: 1,
  },
  uploadTitle: {
    fontFamily: Fonts.heading,
    fontSize: 14,
    fontWeight: '700',
  },
  uploadSubtitle: {
    fontFamily: Fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
  uploadActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionDivider: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    marginVertical: 8,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  avatarButton: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    width: '31%',
    position: 'relative',
  },
  avatarButtonSelected: {
    borderWidth: 2,
  },
  avatarCircle: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500',
    textAlign: 'center',
  },
  avatarLabelSelected: {
    fontFamily: Fonts.bodyBold,
    fontWeight: '700',
  },
  checkBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    borderRadius: 8,
  },
});
