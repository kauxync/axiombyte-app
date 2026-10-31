import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { UserProfile, generateReferralCode } from '@/services/storage';
import { verifyAndConsumeOAuthState } from '@/services/oauth';
import { saveAuthToken, getAuthToken } from '@/services/secureStorage';
import { AppIcon } from '@/components/AppIcon';

// Intercept active WebBrowser auth sessions immediately
WebBrowser.maybeCompleteAuthSession({ skipRedirectCheck: true });

function safeBase64Decode(str: string): string {
  try {
    if (typeof atob === 'function') {
      return atob(str);
    }
  } catch {}
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  const cleanStr = String(str).replace(/=+$/, '');
  for (let bc = 0, bs = 0, buffer = 0, idx = 0; (buffer = cleanStr.charCodeAt(idx++)); ) {
    const charIndex = chars.indexOf(String.fromCharCode(buffer));
    if (~charIndex) {
      bs = bc % 4 ? bs * 64 + charIndex : charIndex;
      if (bc++ % 4) {
        output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
      }
    }
  }
  return output;
}

export default function UniversalAuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    success?: string;
    error?: string;
    error_description?: string;
    userData?: string;
    provider?: string;
    state?: string;
  }>();
  const { user, setAuthenticatedUser } = useAuth();
  const [message, setMessage] = useState('Finalizing AxiomByte Authentication...');
  const isHandledRef = useRef(false);

  useEffect(() => {
    // If user is already authenticated in context, go directly to app without showing any error
    if (user?.id) {
      router.replace('/');
      return;
    }

    if (isHandledRef.current) return;
    isHandledRef.current = true;

    async function handleDeepLink() {
      // 1. If inside an active openAuthSessionAsync on Web, signal completion
      try {
        const completed = WebBrowser.maybeCompleteAuthSession({ skipRedirectCheck: true });
        if (completed.type === 'success') {
          return;
        }
      } catch {}

      // 2. Direct deep-link handling for error responses
      const rawError = params.error || params.error_description;
      if (rawError) {
        const errText = decodeURIComponent(rawError);
        const isCancelled =
          errText.toLowerCase().includes('cancel') ||
          errText.toLowerCase().includes('access_denied') ||
          errText.toLowerCase().includes('dismiss');
        setMessage(isCancelled ? 'Sign-in was cancelled.' : `Sign-in notice: ${errText}`);
        setTimeout(() => router.replace('/'), 1200);
        return;
      }

      if (params.userData) {
        // Enforce state verification to protect against unauthenticated deep-link injection (SEC-01)
        const isStateValid = await verifyAndConsumeOAuthState(params.state);

        if (!isStateValid) {
          // If state failed verification, check if auth session was already established concurrently
          const existingToken = await getAuthToken();
          if (existingToken) {
            router.replace('/');
            return;
          }
          if (__DEV__) console.warn('[Auth Callback] Rejected deep link: missing or invalid state nonce.');
          setMessage('Authentication session is invalid or expired. Please sign in again.');
          setTimeout(() => router.replace('/'), 1800);
          return;
        }

        try {
          // Security: field-level validation on the decoded payload.
          const decodedJson = safeBase64Decode(decodeURIComponent(params.userData));
          const userObj = JSON.parse(decodedJson);

          // Require at minimum a valid email to accept the payload
          if (!userObj || (!userObj.email && !userObj.username)) {
            if (__DEV__) console.warn('[Auth Callback] Rejected payload: missing email/username');
            setMessage('Authentication data is invalid.');
            setTimeout(() => router.replace('/'), 1500);
            return;
          }

          // Validate email format
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (userObj.email && !emailRegex.test(userObj.email)) {
            if (__DEV__) console.warn('[Auth Callback] Rejected payload: malformed email');
            setMessage('Authentication data is invalid.');
            setTimeout(() => router.replace('/'), 1500);
            return;
          }

          // Cap coins at 200 — authoritative balance comes from authenticated API sync
          const safeCoinBalance = Math.min(
            typeof userObj.coins === 'number' ? userObj.coins : 200,
            200
          );

          if (userObj.token) {
            await saveAuthToken(userObj.token);
          }

          const profile: UserProfile = {
            id: userObj.id || 'usr_' + Date.now(),
            name: userObj.name || '',
            username: userObj.username || userObj.email?.split('@')[0] || 'student',
            email: (userObj.email || '').toLowerCase().trim(),
            university: userObj.university || '',
            universityId: userObj.universityId ? Number(userObj.universityId) : undefined,
            collegeDepartment: userObj.collegeDepartment || '',
            collegeDepartmentId: userObj.collegeDepartmentId ? Number(userObj.collegeDepartmentId) : undefined,
            semester: userObj.semester || '',
            avatar: userObj.avatar || '',
            referralCode: userObj.referralCode || generateReferralCode(userObj.username || 'student'),
            coins: safeCoinBalance,
            authProvider: (params.provider as any) || userObj.authProvider || 'google',
            isEmailVerified: true,
            isProfileCompleted: !!userObj.isProfileCompleted,
            createdAt: userObj.createdAt || new Date().toISOString(),
            token: userObj.token || undefined,
          };

          await setAuthenticatedUser(profile);
          setMessage(`Welcome, ${profile.name || profile.username}! Loading your profile...`);
          setTimeout(() => {
            router.replace('/');
          }, 300);
          return;
        } catch (e: any) {
          if (__DEV__) console.error('[Auth Callback] Failed to decode user data:', e);
          setMessage('Authentication failed. Please try again.');
          setTimeout(() => router.replace('/'), 1500);
          return;
        }
      }

      // Check if authenticated already by background thread
      const currentToken = await getAuthToken();
      if (currentToken) {
        router.replace('/');
        return;
      }

      // Default timeout redirect
      setTimeout(() => {
        router.replace('/');
      }, 800);
    }

    handleDeepLink();
  }, [params, router, user, setAuthenticatedUser]);

  return (
    <View style={styles.container}>
      <AppIcon size={56} style={{ marginBottom: 20 }} />
      <ActivityIndicator size="large" color="#208AEF" />
      <Text style={styles.title}>AxiomByte Universal Auth</Text>
      <Text style={styles.subtitle}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030712',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 19,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 15,
    textAlign: 'center',
    maxWidth: 320,
  },
});

