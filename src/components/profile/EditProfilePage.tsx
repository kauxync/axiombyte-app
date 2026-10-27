import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  BackHandler,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useAlert } from '@/context/AlertContext';
import { StyledAlertButton } from '../StyledAlertModal';
import { AvatarPicker } from '../AvatarPicker';
import { Fonts } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/context/ThemeContext';

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

export function EditProfilePage({ onBack }: { onBack: () => void }) {
  const { user, updateProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { showAlert } = useAlert();

  const Alert = {
    alert: (title: string, message?: string, buttons?: StyledAlertButton[]) => {
      showAlert(title, message, buttons);
    },
  };

  const [editName, setEditName] = useState(user?.name || '');
  const [editUsername, setEditUsername] = useState(user?.username || '');
  const [editAvatar, setEditAvatar] = useState(user?.avatar || 'avatar_1');
  const [editUniversity, setEditUniversity] = useState(user?.university || '');
  const [editDepartment, setEditDepartment] = useState(user?.collegeDepartment || '');
  const [editSemester, setEditSemester] = useState(user?.semester || '1');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Missing Name', 'Please enter your full name.');
      return;
    }
    if (!editUsername.trim()) {
      Alert.alert('Missing Username', 'Please enter a valid handle.');
      return;
    }

    setSavingProfile(true);
    try {
      const res = await updateProfile({
        name: editName.trim(),
        username: editUsername.trim().replace(/^@/, ''),
        avatar: editAvatar,
        university: editUniversity.trim(),
        collegeDepartment: editDepartment.trim(),
        semester: editSemester,
      });

      if (res.success) {
        Alert.alert('Profile Updated', 'Your profile details have been saved.');
        onBack();
      } else {
        Alert.alert('Update Failed', res.error || 'Could not update profile.');
      }
    } catch {
      Alert.alert('Error', 'An unexpected error occurred while saving profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  if (!user) return null;

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
              <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Profile</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                Scholar avatar, personal info & academic campus
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
        {/* 1. Avatar Picker Section */}
        <AnimatedCard
          index={0}
          style={[styles.cardBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconBadge, { backgroundColor: 'rgba(56, 189, 248, 0.12)' }]}>
              <Ionicons name="color-palette-outline" size={16} color="#38BDF8" />
            </View>
            <View>
              <Text style={[styles.subSectionTitle, { color: colors.text }]}>Choose Avatar</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
                Select an academic identity badge
              </Text>
            </View>
          </View>
          <AvatarPicker
            selectedId={editAvatar}
            onSelect={setEditAvatar}
            userId={user.id}
          />
        </AnimatedCard>

        {/* 2. Personal Details */}
        <AnimatedCard
          index={1}
          style={[styles.cardBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconBadge, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
              <Ionicons name="person-outline" size={16} color="#F59E0B" />
            </View>
            <View>
              <Text style={[styles.subSectionTitle, { color: colors.text }]}>Personal Details</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
                Your visible scholar identity
              </Text>
            </View>
          </View>

          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>FULL NAME</Text>
          <TextInput
            style={[
              styles.textInput,
              { backgroundColor: colors.cardSecondary, borderColor: colors.border, color: colors.text },
            ]}
            value={editName}
            onChangeText={setEditName}
            placeholder="e.g. Kaushalendra Kumar"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>USERNAME / HANDLE</Text>
          <TextInput
            style={[
              styles.textInput,
              { backgroundColor: colors.cardSecondary, borderColor: colors.border, color: colors.text },
            ]}
            value={editUsername}
            onChangeText={setEditUsername}
            placeholder="e.g. kaushalendra"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
          />

          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>REGISTERED EMAIL</Text>
          <View
            style={[
              styles.readOnlyInputRow,
              { backgroundColor: colors.cardSecondary, borderColor: colors.borderSubtle },
            ]}>
            <Ionicons name="mail-outline" size={16} color={colors.textMuted} />
            <Text style={[styles.readOnlyEmailText, { color: colors.textSecondary }]}>{user.email}</Text>
            <View style={styles.verifiedBadge}>
              <Ionicons name="shield-checkmark" size={11} color="#10B981" />
              <Text style={styles.verifiedBadgeText}>Verified</Text>
            </View>
          </View>
        </AnimatedCard>

        {/* 3. Academic Credentials */}
        <AnimatedCard
          index={2}
          style={[styles.cardBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIconBadge, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
              <Ionicons name="school-outline" size={16} color="#10B981" />
            </View>
            <View>
              <Text style={[styles.subSectionTitle, { color: colors.text }]}>Academic Information</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
                Campus institution & curriculum term
              </Text>
            </View>
          </View>

          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>UNIVERSITY / INSTITUTE</Text>
          <TextInput
            style={[
              styles.textInput,
              { backgroundColor: colors.cardSecondary, borderColor: colors.border, color: colors.text },
            ]}
            value={editUniversity}
            onChangeText={setEditUniversity}
            placeholder="e.g. Delhi Technological University"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>DEPARTMENT / COLLEGE</Text>
          <TextInput
            style={[
              styles.textInput,
              { backgroundColor: colors.cardSecondary, borderColor: colors.border, color: colors.text },
            ]}
            value={editDepartment}
            onChangeText={setEditDepartment}
            placeholder="e.g. Computer Science & Engineering"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>CURRENT SEMESTER (1 - 8)</Text>
          <View style={styles.semesterRow}>
            {['1', '2', '3', '4', '5', '6', '7', '8'].map((sem) => {
              const isSelected = editSemester === sem;
              return (
                <Pressable
                  key={sem}
                  onPress={() => setEditSemester(sem)}
                  style={[
                    styles.semesterChip,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.cardSecondary,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.semesterChipText,
                      { color: isSelected ? '#0F172A' : colors.textSecondary },
                    ]}>
                    {sem}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </AnimatedCard>

        {/* 4. Save Changes Button */}
        <Pressable
          onPress={handleSaveProfile}
          disabled={savingProfile}
          style={({ pressed }) => [
            styles.primaryActionBtn,
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.85 },
          ]}>
          {savingProfile ? (
            <ActivityIndicator color="#0F172A" size="small" />
          ) : (
            <View style={styles.saveBtnContent}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#0F172A" />
              <Text style={styles.primaryActionBtnText}>Save Profile Changes</Text>
            </View>
          )}
        </Pressable>
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
    marginBottom: 12,
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
  inputLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 10,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: Fonts.body,
    fontSize: 14.5,
  },
  readOnlyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 8,
  },
  readOnlyEmailText: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    flex: 1,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  verifiedBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  semesterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  semesterChip: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  semesterChipText: {
    fontFamily: Fonts.heading,
    fontSize: 14.5,
    fontWeight: '800',
  },
  primaryActionBtn: {
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 24,
  },
  saveBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  primaryActionBtnText: {
    fontFamily: Fonts.heading,
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
});
