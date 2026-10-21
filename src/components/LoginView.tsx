import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  BackHandler,
  ToastAndroid,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { Fonts } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/context/ThemeContext';

export function LoginView({ onLoggedIn }: { onLoggedIn: () => void }) {
  const {
    loginWithEmail,
    sendEmailVerification,
    signUpWithEmail,
    loginWithGoogle,
    loginWithGithub,
  } = useAuth();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Email Verification State
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  // Resend countdown timer
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (resendCountdown > 0) {
      timer = setTimeout(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // Handle hardware back navigation on Login screen
  useEffect(() => {
    let lastBackPress = 0;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (verifyingEmail) {
        setVerifyingEmail(false);
        setVerificationCode('');
        setErrorMessage('');
        setInfoMessage('');
        return true;
      }
      if (isSignUp) {
        setIsSignUp(false);
        setErrorMessage('');
        setInfoMessage('');
        return true;
      }
      const now = Date.now();
      if (now - lastBackPress < 2000) {
        BackHandler.exitApp();
        return true;
      }
      lastBackPress = now;
      if (Platform.OS === 'android') {
        ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
      }
      return true;
    });
    return () => sub.remove();
  }, [verifyingEmail, isSignUp]);

  // Handle Initial Form Submission
  const handleFormSubmit = async () => {
    setErrorMessage('');
    setInfoMessage('');

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    // In Sign-up mode: validate confirm password & initiate OTP email verification
    if (isSignUp) {
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match. Please recheck.');
        return;
      }

      setLoading(true);
      try {
        const res = await sendEmailVerification(email.trim());
        if (!res.success) {
          setErrorMessage(res.message || 'Could not send verification code.');
        } else {
          setVerifyingEmail(true);
          setResendCountdown(60);
          if (res.debugCode) {
            setDebugOtp(res.debugCode);
          }
          setInfoMessage(`A 6-digit code has been sent to ${email.trim()}`);
        }
      } catch (e: any) {
        setErrorMessage(e?.message || 'Failed to initiate verification.');
      } finally {
        setLoading(false);
      }
    } else {
      // In Sign-in mode: direct authentication
      setLoading(true);
      try {
        const res = await loginWithEmail(email.trim(), password);
        if (!res.success) {
          if (res.requiresEmailVerification) {
            // Account email unverified - dispatch OTP code and prompt verification
            const verifySendRes = await sendEmailVerification(email.trim());
            setVerifyingEmail(true);
            setResendCountdown(60);
            if (verifySendRes.debugCode) {
              setDebugOtp(verifySendRes.debugCode);
            }
            setInfoMessage(
              verifySendRes.message ||
                `Your email is not verified yet. A 6-digit verification code has been sent to ${email.trim()}.`
            );
          } else {
            setErrorMessage(res.error || 'Authentication failed. Please check credentials.');
          }
        } else {
          onLoggedIn();
        }
      } catch (e: any) {
        setErrorMessage(e?.message || 'An unexpected error occurred.');
      } finally {
        setLoading(false);
      }
    }
  };

  // Handle Verification Code Submission
  const handleVerifyCodeSubmit = async () => {
    setErrorMessage('');
    setInfoMessage('');

    if (!verificationCode.trim() || verificationCode.trim().length !== 6) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const res = await signUpWithEmail(email.trim(), password, verificationCode.trim());
      if (!res.success) {
        setErrorMessage(res.error || 'Verification failed. Please retry.');
      } else {
        onLoggedIn();
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'Could not complete registration.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Resending Verification Code
  const handleResendCode = async () => {
    if (resendCountdown > 0) return;
    setErrorMessage('');
    setInfoMessage('');
    setLoading(true);

    try {
      const res = await sendEmailVerification(email.trim());
      if (res.success) {
        setResendCountdown(60);
        if (res.debugCode) {
          setDebugOtp(res.debugCode);
        }
        setInfoMessage('New verification code sent! Check your inbox.');
      } else {
        setErrorMessage(res.message || 'Failed to resend code.');
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'Could not resend code.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMessage('');
    setInfoMessage('');
    setGoogleLoading(true);
    try {
      const res = await loginWithGoogle();
      if (res.success) {
        onLoggedIn();
      } else if (res.error) {
        setErrorMessage(res.error);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Google sign-in could not be completed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGithubAuth = async () => {
    setErrorMessage('');
    setInfoMessage('');
    setGithubLoading(true);
    try {
      const res = await loginWithGithub();
      if (res.success) {
        onLoggedIn();
      } else if (res.error) {
        setErrorMessage(res.error);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'GitHub sign-in could not be completed.');
    } finally {
      setGithubLoading(false);
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
              paddingBottom: Math.max(insets.bottom, 24) + 24,
            },
          ]}
          showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <View
              style={[
                styles.logoBadge,
                {
                  backgroundColor: colors.primaryBg,
                  borderColor: `${colors.primary}40`,
                },
              ]}>
              <Ionicons name="terminal" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.appName, { color: colors.text }]}>
              Axiom<Text style={{ color: colors.primary }}>Byte</Text>
            </Text>
            <Text style={[styles.tagline, { color: colors.textSecondary }]}>
              {verifyingEmail
                ? 'Verify your email to activate your account'
                : isSignUp
                ? 'Create your CS & Math academic account'
                : 'Welcome back to your computing workspace'}
            </Text>
          </View>

          {/* Feedback Messages */}
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

          {infoMessage ? (
            <View style={[styles.infoBox, { backgroundColor: colors.primaryBg, borderColor: `${colors.primary}40` }]}>
              <Ionicons name="information-circle" size={18} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.text }]}>{infoMessage}</Text>
            </View>
          ) : null}

          {/* VIEW A: Email Verification Step */}
          {verifyingEmail ? (
            <View style={styles.verificationContainer}>
              <View
                style={[
                  styles.verifyCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}>
                <View style={[styles.verifyIconBadge, { backgroundColor: colors.primaryBg }]}>
                  <Ionicons name="mail-open-outline" size={28} color={colors.primary} />
                </View>

                <Text style={[styles.verifyTitle, { color: colors.text }]}>Enter Verification Code</Text>
                <Text style={[styles.verifySubtitle, { color: colors.textMuted }]}>
                  We sent a 6-digit code to{' '}
                  <Text style={[styles.verifyEmailHighlight, { color: colors.primary }]}>{email}</Text>
                </Text>

                {/* Development-only OTP Code Banner — hidden in production builds */}
                {__DEV__ && debugOtp ? (
                  <View style={[styles.debugOtpBanner, { backgroundColor: `${colors.primary}15` }]}>
                    <Ionicons name="sparkles" size={14} color={colors.primary} />
                    <Text style={[styles.debugOtpText, { color: colors.primary }]}>
                      Test OTP Code: <Text style={{ fontWeight: '700' }}>{debugOtp}</Text>
                    </Text>
                  </View>
                ) : null}

                {/* 6-Digit Code Input */}
                <View
                  style={[
                    styles.otpInputWrapper,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.primary,
                    },
                  ]}>
                  <TextInput
                    style={[styles.otpInput, { color: colors.text }]}
                    placeholder="000000"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={6}
                    value={verificationCode}
                    onChangeText={setVerificationCode}
                    autoFocus
                  />
                </View>

                {/* Resend and Countdown */}
                <View style={styles.resendRow}>
                  {resendCountdown > 0 ? (
                    <Text style={[styles.countdownText, { color: colors.textMuted }]}>
                      Resend code in {resendCountdown}s
                    </Text>
                  ) : (
                    <Pressable onPress={handleResendCode} disabled={loading}>
                      <Text style={[styles.resendBtnText, { color: colors.primary }]}>
                        Resend Verification Code
                      </Text>
                    </Pressable>
                  )}
                </View>

                {/* Action Buttons */}
                <Pressable
                  onPress={handleVerifyCodeSubmit}
                  disabled={loading}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    {
                      backgroundColor: colors.primary,
                      width: '100%',
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
                      <Text style={styles.primaryBtnText}>
                        {isSignUp ? 'Verify And Create Account' : 'Verify And Continue'}
                      </Text>
                      <Ionicons name="checkmark-circle" size={19} color="#FFFFFF" />
                    </>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => {
                    setVerifyingEmail(false);
                    setVerificationCode('');
                    setErrorMessage('');
                    setInfoMessage('');
                  }}
                  style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={16} color={colors.textMuted} />
                  <Text style={[styles.backBtnText, { color: colors.textMuted }]}>Change Email</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            /* VIEW B: Normal Sign In / Sign Up Form */
            <>
              {/* Segmented Switcher */}
              <View
                style={[
                  styles.tabContainer,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}>
                <Pressable
                  onPress={() => {
                    setIsSignUp(false);
                    setErrorMessage('');
                    setInfoMessage('');
                  }}
                  style={[
                    styles.tabBtn,
                    !isSignUp && [styles.tabBtnActive, { backgroundColor: colors.cardSecondary }],
                  ]}>
                  <Text
                    style={[
                      styles.tabBtnText,
                      { color: colors.textMuted },
                      !isSignUp && [styles.tabBtnTextActive, { color: colors.text }],
                    ]}>
                    Sign In
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setIsSignUp(true);
                    setErrorMessage('');
                    setInfoMessage('');
                  }}
                  style={[
                    styles.tabBtn,
                    isSignUp && [styles.tabBtnActive, { backgroundColor: colors.cardSecondary }],
                  ]}>
                  <Text
                    style={[
                      styles.tabBtnText,
                      { color: colors.textMuted },
                      isSignUp && [styles.tabBtnTextActive, { color: colors.text }],
                    ]}>
                    Sign Up
                  </Text>
                </Pressable>
              </View>

              {/* Form Fields */}
              <View style={styles.form}>
                {/* Email (Changed from Student Email to Email) */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>EMAIL</Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      {
                        backgroundColor: colors.inputBg,
                      },
                    ]}>
                    <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      placeholder="name@university.edu"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      value={email}
                      onChangeText={setEmail}
                    />
                  </View>
                </View>

                {/* Password */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>PASSWORD</Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      {
                        backgroundColor: colors.inputBg,
                      },
                    ]}>
                    <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      placeholder="••••••••••••"
                      placeholderTextColor={colors.textMuted}
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={setPassword}
                    />
                    <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color={colors.textMuted}
                      />
                    </Pressable>
                  </View>
                </View>

                {/* Confirm Password (Only shown in Sign Up mode) */}
                {isSignUp && (
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.textMuted }]}>CONFIRM PASSWORD</Text>
                    <View
                      style={[
                        styles.inputWrapper,
                        {
                          backgroundColor: colors.inputBg,
                          ...(confirmPassword && confirmPassword !== password
                            ? { borderWidth: 1, borderColor: colors.error }
                            : {}),
                        },
                      ]}>
                      <Ionicons name="shield-checkmark-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                      <TextInput
                        style={[styles.input, { color: colors.text }]}
                        placeholder="••••••••••••"
                        placeholderTextColor={colors.textMuted}
                        secureTextEntry={!showConfirmPassword}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                      />
                      <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeBtn}>
                        <Ionicons
                          name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={18}
                          color={colors.textMuted}
                        />
                      </Pressable>
                    </View>
                    {confirmPassword && confirmPassword !== password ? (
                      <Text style={[styles.fieldErrorText, { color: colors.error }]}>Passwords do not match</Text>
                    ) : null}
                  </View>
                )}

                {/* Submit Button */}
                <Pressable
                  onPress={handleFormSubmit}
                  disabled={loading}
                  style={({ pressed }) => [
                    styles.primaryBtn,
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
                      <Text style={styles.primaryBtnText}>
                        {isSignUp ? 'Continue & Verify Email' : 'Sign In With Email'}
                      </Text>
                      <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                    </>
                  )}
                </Pressable>
              </View>

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                <Text style={[styles.dividerText, { color: colors.textMuted }]}>OR CONTINUE WITH</Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              </View>

              {/* OAuth Buttons */}
              <View style={styles.oauthContainer}>
                <Pressable
                  onPress={handleGoogleAuth}
                  disabled={googleLoading || githubLoading || loading}
                  style={[
                    styles.oauthBtn,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                    googleLoading && { opacity: 0.7 },
                  ]}>
                  {googleLoading ? (
                    <ActivityIndicator size="small" color="#EA4335" />
                  ) : (
                    <>
                      <Ionicons name="logo-google" size={18} color="#EA4335" />
                      <Text style={[styles.oauthBtnText, { color: colors.text }]}>Continue with Google</Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  onPress={handleGithubAuth}
                  disabled={googleLoading || githubLoading || loading}
                  style={[
                    styles.oauthBtn,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                    githubLoading && { opacity: 0.7 },
                  ]}>
                  {githubLoading ? (
                    <ActivityIndicator size="small" color={colors.text} />
                  ) : (
                    <>
                      <Ionicons name="logo-github" size={18} color={colors.text} />
                      <Text style={[styles.oauthBtnText, { color: colors.text }]}>Continue to GitHub</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingVertical: 24,
  },
  header: {
    alignItems: 'center',
    marginVertical: 18,
  },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
  },
  appName: {
    fontFamily: Fonts.heading,
    fontSize: 27,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tagline: {
    fontFamily: Fonts.body,
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginVertical: 18,
    borderWidth: 1,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {},
  tabBtnText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
    fontWeight: '600',
  },
  tabBtnTextActive: {
    fontFamily: Fonts.bodyBold,
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
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  infoText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    flex: 1,
  },
  fieldErrorText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    marginTop: 2,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    fontFamily: Fonts.body,
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
    borderWidth: 0,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any, outlineWidth: 0 } : {}),
  },
  eyeBtn: {
    padding: 6,
  },
  primaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  primaryBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  oauthContainer: {
    flexDirection: 'column',
    gap: 10,
  },
  oauthBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    paddingVertical: 13,
    borderRadius: 12,
  },
  oauthBtnText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
    fontWeight: '600',
  },
  // Verification Step Styling
  verificationContainer: {
    marginTop: 10,
  },
  verifyCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  verifyIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  verifyTitle: {
    fontFamily: Fonts.heading,
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 6,
  },
  verifySubtitle: {
    fontFamily: Fonts.body,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
  },
  verifyEmailHighlight: {
    fontWeight: '700',
  },
  debugOtpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 16,
  },
  debugOtpText: {
    fontFamily: Fonts.mono,
    fontSize: 13,
  },
  otpInputWrapper: {
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  otpInput: {
    fontFamily: Fonts.mono,
    fontSize: 29,
    fontWeight: '800',
    letterSpacing: 12,
    textAlign: 'center',
    width: '100%',
    borderWidth: 0,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any, outlineWidth: 0 } : {}),
  },
  resendRow: {
    marginBottom: 16,
  },
  countdownText: {
    fontFamily: Fonts.body,
    fontSize: 13,
  },
  resendBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    fontWeight: '700',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    padding: 8,
  },
  backBtnText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
  },
});
