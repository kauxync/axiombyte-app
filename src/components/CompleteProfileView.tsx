import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { AvatarPicker } from './AvatarPicker';
import { AcademicAutocompleteInput } from './AcademicAutocompleteInput';
import { autoCreateAcademic } from '@/services/academicSearch';
import { checkUsernameAvailability } from '@/services/api';
import { StyledAlertModal, StyledAlertConfig } from './StyledAlertModal';
import { Fonts } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/context/ThemeContext';

const SEMESTER_OPTIONS = [
  '1st Semester',
  '2nd Semester',
  '3rd Semester',
  '4th Semester',
  '5th Semester',
  '6th Semester',
  '7th Semester',
  '8th Semester',
  'Postgraduate / Research',
  'Self-Taught / Industry',
];

export function CompleteProfileView({ onComplete }: { onComplete: () => void }) {
  const { user, updateProfile } = useAuth();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [university, setUniversity] = useState(user?.university || '');
  const [collegeDepartment, setCollegeDepartment] = useState(user?.collegeDepartment || '');
  const [semester, setSemester] = useState(user?.semester || ''); // No predefined demo value
  const [avatar, setAvatar] = useState(user?.avatar || ''); // No predefined demo value
  const [appliedReferralCode, setAppliedReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSemesterPicker, setShowSemesterPicker] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Designed Alert Modal State
  const [alertConfig, setAlertConfig] = useState<StyledAlertConfig>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });

  const showAlert = (
    title: string,
    message: string,
    type: 'error' | 'success' | 'warning' | 'info' = 'error',
    onConfirm?: () => void
  ) => {
    setAlertConfig({
      visible: true,
      title,
      message,
      type,
      onConfirm,
    });
  };

  // Synchronous format & current user validation
  const cleanUsername = username.trim().toLowerCase();
  const isTooShort = cleanUsername.length > 0 && cleanUsername.length < 3;
  const isInvalidChars =
    cleanUsername.length > 0 && !/^[a-zA-Z0-9][a-zA-Z0-9_.]*$/.test(cleanUsername);
  const isCurrentUsername =
    !!user?.username && cleanUsername === user.username.toLowerCase();

  // Async server check state
  const [asyncCheck, setAsyncCheck] = useState<{
    status: 'idle' | 'checking' | 'available' | 'taken';
    feedback: string;
    checkedUsername: string;
  }>({
    status: 'idle',
    feedback: '',
    checkedUsername: '',
  });

  useEffect(() => {
    if (!cleanUsername || isTooShort || isInvalidChars || isCurrentUsername) {
      return;
    }

    const timer = setTimeout(async () => {
      setAsyncCheck({
        status: 'checking',
        feedback: 'Checking availability...',
        checkedUsername: cleanUsername,
      });

      try {
        const res = await checkUsernameAvailability(cleanUsername, user?.id);
        if (res.data?.available) {
          setAsyncCheck({
            status: 'available',
            feedback: `@${cleanUsername} is available`,
            checkedUsername: cleanUsername,
          });
        } else {
          setAsyncCheck({
            status: 'taken',
            feedback: res.message || `@${cleanUsername} is already taken`,
            checkedUsername: cleanUsername,
          });
        }
      } catch {
        setAsyncCheck({
          status: 'available',
          feedback: `@${cleanUsername} is available`,
          checkedUsername: cleanUsername,
        });
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [cleanUsername, isTooShort, isInvalidChars, isCurrentUsername, user?.id]);

  // Derived effective status & feedback
  const usernameStatus: 'idle' | 'checking' | 'available' | 'taken' | 'invalid' =
    !cleanUsername
      ? 'idle'
      : isTooShort
      ? 'invalid'
      : isInvalidChars
      ? 'invalid'
      : isCurrentUsername
      ? 'available'
      : asyncCheck.checkedUsername === cleanUsername
      ? asyncCheck.status
      : 'checking';

  const usernameFeedback: string =
    !cleanUsername
      ? ''
      : isTooShort
      ? 'Must be at least 3 characters'
      : isInvalidChars
      ? 'Letters, numbers, underscores, and dots only'
      : isCurrentUsername
      ? 'Your current username'
      : asyncCheck.checkedUsername === cleanUsername
      ? asyncCheck.feedback
      : 'Checking availability...';

  const handleSubmit = async () => {
    setErrorMessage('');
    if (!name.trim()) {
      setErrorMessage('Please enter your full name.');
      showAlert('Required Field', 'Please enter your full name.', 'warning');
      return;
    }
    if (!username.trim() || username.length < 3) {
      setErrorMessage('Username must be at least 3 characters.');
      showAlert('Required Field', 'Username must be at least 3 characters.', 'warning');
      return;
    }
    if (usernameStatus === 'taken') {
      setErrorMessage('Username is already taken.');
      showAlert('Username Unavailable', 'The username you selected is already taken. Please choose another username.', 'error');
      return;
    }
    if (usernameStatus === 'invalid') {
      setErrorMessage('Invalid username format.');
      showAlert('Invalid Username', 'Username must be at least 3 characters and contain only letters, numbers, underscores, and dots.', 'warning');
      return;
    }
    if (!university.trim()) {
      setErrorMessage('Please enter your university / institute.');
      showAlert('Required Field', 'Please enter your university / institute.', 'warning');
      return;
    }
    if (!collegeDepartment.trim()) {
      setErrorMessage('Please enter your college / department.');
      showAlert('Required Field', 'Please enter your college / department.', 'warning');
      return;
    }
    if (!semester.trim()) {
      setErrorMessage('Please select your current semester.');
      showAlert('Required Field', 'Please select your current semester.', 'warning');
      return;
    }
    if (!avatar.trim()) {
      setErrorMessage('Please choose an avatar or upload your profile picture.');
      showAlert('Required Field', 'Please choose an avatar or upload your profile picture.', 'warning');
      return;
    }

    setLoading(true);
    try {
      // Auto-create/persist university & department to DB & local catalog if not already present
      autoCreateAcademic('university', university.trim());
      autoCreateAcademic('department', collegeDepartment.trim());

      const res = await updateProfile({
        name: name.trim(),
        username: username.trim(),
        university: university.trim(),
        collegeDepartment: collegeDepartment.trim(),
        semester: semester.trim(),
        avatar: avatar.trim(),
        appliedReferralCode: appliedReferralCode.trim() || undefined,
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Failed to save profile.');
        showAlert('Profile Setup Error', res.error || 'Failed to save profile.', 'error');
      } else {
        if (res.coinsBonus && res.coinsBonus > 0) {
          showAlert(
            '🎉 Welcome Bonus Unlocked!',
            `Referral code applied successfully!\n+${res.coinsBonus} Coins (₹${(res.coinsBonus / 100).toFixed(2)}) added to your balance!`,
            'success',
            () => onComplete()
          );
        } else {
          onComplete();
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not complete profile.');
      showAlert('Error', err?.message || 'Could not complete profile.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top, 16),
              paddingBottom: Math.max(insets.bottom, 24) + 40,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <View
              style={[
                styles.stepBadge,
                {
                  backgroundColor: colors.primaryBg,
                },
              ]}>
              <Text style={[styles.stepBadgeText, { color: colors.primary }]}>
                STEP 2 OF 2 • ACADEMIC PROFILE
              </Text>
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Complete Your Student Profile</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Customize your CS & Mathematics workspace and connect with your university cohort.
            </Text>
          </View>

          {/* Error Banner */}
          {errorMessage ? (
            <View
              style={[
                styles.errorBox,
                {
                  backgroundColor: colors.errorBg,
                  borderColor: colors.errorBorder,
                  borderLeftColor: colors.error,
                },
              ]}>
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Avatar Selector */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              PROFILE PICTURE / AVATAR *
            </Text>
            <AvatarPicker
              selectedId={avatar}
              onSelect={setAvatar}
              userId={user?.id}
              onShowAlert={showAlert}
            />
          </View>

          {/* Form Fields */}
          <View style={styles.form}>
            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>FULL NAME *</Text>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: !!errorMessage && !name.trim() ? colors.error : colors.border,
                  },
                ]}>
                <Ionicons name="person-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Full name"
                  placeholderTextColor={colors.textMuted}
                  value={name}
                  onChangeText={setName}
                />
              </View>
            </View>

            {/* Username with Real-time Availability Verification */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>USERNAME *</Text>
                {usernameStatus !== 'idle' && (
                  <View
                    style={[
                      styles.usernameTag,
                      {
                        backgroundColor:
                          usernameStatus === 'available'
                            ? 'rgba(16, 185, 129, 0.12)'
                            : usernameStatus === 'taken'
                            ? 'rgba(239, 68, 68, 0.12)'
                            : usernameStatus === 'checking'
                            ? 'rgba(56, 189, 248, 0.12)'
                            : 'rgba(245, 158, 11, 0.12)',
                      },
                    ]}>
                    <Text
                      style={[
                        styles.usernameTagText,
                        {
                          color:
                            usernameStatus === 'available'
                              ? '#10B981'
                              : usernameStatus === 'taken'
                              ? '#EF4444'
                              : usernameStatus === 'checking'
                              ? colors.primary
                              : '#F59E0B',
                        },
                      ]}>
                      {usernameStatus === 'checking'
                        ? 'Checking...'
                        : usernameStatus === 'available'
                        ? 'Available'
                        : usernameStatus === 'taken'
                        ? 'Unavailable'
                        : 'Invalid'}
                    </Text>
                  </View>
                )}
              </View>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor:
                      usernameStatus === 'available'
                        ? '#10B981'
                        : usernameStatus === 'taken'
                        ? '#EF4444'
                        : usernameStatus === 'invalid' && username.length > 0
                        ? '#F59E0B'
                        : !!errorMessage && (!username.trim() || username.length < 3)
                        ? colors.error
                        : colors.border,
                  },
                ]}>
                <Ionicons name="at-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Choose a username"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={username}
                  onChangeText={setUsername}
                />
                {usernameStatus === 'checking' ? (
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 4 }} />
                ) : usernameStatus === 'available' ? (
                  <Ionicons name="checkmark-circle" size={18} color="#10B981" style={{ marginRight: 4 }} />
                ) : usernameStatus === 'taken' ? (
                  <Ionicons name="close-circle" size={18} color="#EF4444" style={{ marginRight: 4 }} />
                ) : usernameStatus === 'invalid' && username.length > 0 ? (
                  <Ionicons name="alert-circle" size={18} color="#F59E0B" style={{ marginRight: 4 }} />
                ) : null}
              </View>
              {usernameFeedback ? (
                <View style={styles.usernameStatusRow}>
                  <Ionicons
                    name={
                      usernameStatus === 'available'
                        ? 'checkmark-circle'
                        : usernameStatus === 'taken'
                        ? 'close-circle'
                        : usernameStatus === 'checking'
                        ? 'time-outline'
                        : 'alert-circle'
                    }
                    size={13}
                    color={
                      usernameStatus === 'available'
                        ? '#10B981'
                        : usernameStatus === 'taken'
                        ? '#EF4444'
                        : usernameStatus === 'checking'
                        ? colors.primary
                        : '#F59E0B'
                    }
                  />
                  <Text
                    style={[
                      styles.usernameStatusText,
                      {
                        color:
                          usernameStatus === 'available'
                            ? '#10B981'
                            : usernameStatus === 'taken'
                            ? '#EF4444'
                            : usernameStatus === 'checking'
                            ? colors.primary
                            : '#F59E0B',
                      },
                    ]}>
                    {usernameFeedback}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* University - Auto-searched from DB, multi-tier cached, auto-created */}
            <AcademicAutocompleteInput
              label="UNIVERSITY / INSTITUTE *"
              iconName="school-outline"
              type="university"
              value={university}
              onChangeText={setUniversity}
              placeholder="Search or enter university / institute"
              hasError={!!errorMessage && !university.trim()}
              colors={colors}
            />

            {/* College / Department - Auto-searched from DB, multi-tier cached, auto-created */}
            <AcademicAutocompleteInput
              label="COLLEGE / DEPARTMENT *"
              iconName="business-outline"
              type="department"
              value={collegeDepartment}
              onChangeText={setCollegeDepartment}
              placeholder="Search or enter college / department"
              hasError={!!errorMessage && !collegeDepartment.trim()}
              colors={colors}
            />

            {/* Semester Selector */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>CURRENT SEMESTER *</Text>
              <Pressable
                onPress={() => setShowSemesterPicker(!showSemesterPicker)}
                style={[
                  styles.selectWrapper,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: !!errorMessage && !semester.trim() ? colors.error : colors.border,
                  },
                ]}>
                <Ionicons name="calendar-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                <Text
                  style={[
                    styles.selectValueText,
                    { color: semester ? colors.text : colors.textMuted },
                  ]}>
                  {semester || 'Select current semester'}
                </Text>
                <Ionicons
                  name={showSemesterPicker ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textMuted}
                />
              </Pressable>

              {/* Semester Dropdown list */}
              {showSemesterPicker && (
                <View
                  style={[
                    styles.dropdownList,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}>
                  {SEMESTER_OPTIONS.map((item) => (
                    <Pressable
                      key={item}
                      onPress={() => {
                        setSemester(item);
                        setShowSemesterPicker(false);
                      }}
                      style={[
                        styles.dropdownItem,
                        { borderBottomColor: colors.borderSubtle },
                        semester === item && [
                          styles.dropdownItemActive,
                          { backgroundColor: colors.cardSecondary },
                        ],
                      ]}>
                      <Text
                        style={[
                          styles.dropdownItemText,
                          { color: colors.textSecondary },
                          semester === item && [
                            styles.dropdownItemTextActive,
                            { color: colors.primary },
                          ],
                        ]}>
                        {item}
                      </Text>
                      {semester === item && (
                        <Ionicons name="checkmark" size={16} color={colors.primary} />
                      )}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Referral Code (Optional) */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>REFERRAL CODE</Text>
                <Text style={styles.optionalBadge}>OPTIONAL • +100 COINS</Text>
              </View>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.border,
                  },
                ]}>
                <Ionicons name="gift-outline" size={18} color="#F59E0B" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Enter referral code"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                  value={appliedReferralCode}
                  onChangeText={setAppliedReferralCode}
                />
              </View>
              <Text style={[styles.referralHint, { color: colors.textMuted }]}>
                🎁 Enter a friend&apos;s code to get 100 free Coins (₹1.00) credited to your wallet!
              </Text>
            </View>

            {/* Save Button */}
            <Pressable
              onPress={handleSubmit}
              disabled={loading}
              style={({ pressed }) => [
                styles.submitBtn,
                {
                  backgroundColor: colors.primary,
                  shadowColor: colors.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.25,
                  shadowRadius: 8,
                  elevation: 4,
                },
                pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
                loading && { opacity: 0.7 },
              ]}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.submitBtnText}>Save Profile & Enter Workspace</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Theme-Aware Designed Alert Modal */}
      <StyledAlertModal
        config={alertConfig}
        onClose={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#020617',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  stepBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  stepBadgeText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
    letterSpacing: 1,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 27,
    fontWeight: '700',
    color: '#F8FAFC',
    lineHeight: 35,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 6,
    lineHeight: 19,
  },
  section: {
    marginBottom: 18,
  },
  sectionLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  optionalBadge: {
    fontFamily: Fonts.bodyBold,
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    fontFamily: Fonts.body,
    flex: 1,
    color: '#F8FAFC',
    fontSize: 15,
    paddingVertical: 12,
  },
  selectWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
  selectValueText: {
    fontFamily: Fonts.body,
    flex: 1,
    color: '#F8FAFC',
    fontSize: 15,
  },
  dropdownList: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  dropdownItemActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  dropdownItemText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: '#94A3B8',
  },
  dropdownItemTextActive: {
    fontFamily: Fonts.bodyBold,
    color: '#38BDF8',
    fontWeight: '700',
  },
  referralHint: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    lineHeight: 17,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#38BDF8',
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 12,
  },
  submitBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  usernameTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  usernameTagText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  usernameStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  usernameStatusText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderLeftWidth: 3,
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    flex: 1,
  },
});

