import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { UserProfile, saveStoredProfile, generateReferralCode } from '@/services/storage';

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
    userData?: string;
    provider?: string;
  }>();
  const { user, setAuthenticatedUser } = useAuth();
  const [message, setMessage] = useState('Finalizing AxiomByte Authentication...');

  useEffect(() => {
    async function handleDeepLink() {
      // 1. If inside an active openAuthSessionAsync, signal completion
      // The oauth.ts parseBrokerRedirectUrl handles the actual parsing there.
      try {
        const completed = WebBrowser.maybeCompleteAuthSession({ skipRedirectCheck: true });
        if (completed.type === 'success') {
          return;
        }
      } catch {}

      // 2. Direct deep-link handling (opened externally, outside a modal)
      if (params.error) {
        setMessage(`Sign-in error: ${params.error}`);
        setTimeout(() => router.replace('/'), 2000);
        return;
      }

      if (params.userData) {
        try {
          // Security: validate that this deep link came from a known source.
          // Direct deep-links via axiombyte:// cannot have their hostname verified,
          // so we apply strict field-level validation on the decoded payload.
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

          const profile: UserProfile = {
            id: userObj.id || 'usr_' + Date.now(),
            name: userObj.name || '',
            username: userObj.username || userObj.email?.split('@')[0] || 'student',
            email: (userObj.email || '').toLowerCase().trim(),
            university: userObj.university || '',
            collegeDepartment: userObj.collegeDepartment || '',
            semester: userObj.semester || '',
            avatar: userObj.avatar || '',
            referralCode: userObj.referralCode || generateReferralCode(userObj.username || 'student'),
            coins: safeCoinBalance,
            authProvider: (params.provider as any) || userObj.authProvider || 'google',
            isEmailVerified: true,
            isProfileCompleted: !!userObj.isProfileCompleted,
            createdAt: userObj.createdAt || new Date().toISOString(),
          };

          await setAuthenticatedUser(profile);
          setMessage('Authentication verified! Loading your profile...');
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

      // Default timeout redirect
      setTimeout(() => {
        router.replace('/');
      }, 1000);
    }

    handleDeepLink();
  }, [params, router, user]);

  return (
    <View style={styles.container}>
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

