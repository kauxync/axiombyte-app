import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { authWithOAuth } from '@/services/api';
import { saveStoredProfile, UserProfile, generateReferralCode } from '@/services/storage';
import { AppIcon } from '@/components/AppIcon';

// Intercept popup completions immediately
WebBrowser.maybeCompleteAuthSession({ skipRedirectCheck: true });

export default function GoogleAuthCallbackScreen() {
  const router = useRouter();
  const [statusText, setStatusText] = useState('Completing Google Sign-in...');

  useEffect(() => {
    async function processAuth() {
      // 1. First attempt standard Expo WebBrowser popup resolution
      try {
        const completed = WebBrowser.maybeCompleteAuthSession({ skipRedirectCheck: true });
        if (completed.type === 'success') {
          return;
        }
      } catch {
        // Fall through to full-page handling if not in a popup
      }

      // 2. If opened in full tab / direct redirect on Web
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try {
          const rawUrl = window.location.href;
          const urlPart = rawUrl.includes('#') ? rawUrl.split('#')[1] : rawUrl.split('?')[1];
          const params = new URLSearchParams(urlPart || '');
          const accessToken = params.get('access_token');

          if (accessToken) {
            setStatusText('Connecting your Google Account...');
            const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            const googleUser = await userRes.json();

            if (googleUser.email) {
              const apiRes = await authWithOAuth({
                provider: 'google',
                providerId: googleUser.sub || 'goog_' + Date.now(),
                email: googleUser.email.toLowerCase(),
                name: googleUser.name || 'Google Student',
                username: (googleUser.given_name || googleUser.email.split('@')[0])
                  .replace(/[^a-zA-Z0-9]/g, '')
                  .toLowerCase(),
                avatar: googleUser.picture || '',
              });

              const serverUser = apiRes.data;
              const profile: UserProfile = {
                id: serverUser?.id || 'usr_goog_' + (googleUser.sub || Date.now()),
                name: serverUser?.name || googleUser.name || '',
                username: serverUser?.username || googleUser.email.split('@')[0],
                email: googleUser.email.toLowerCase(),
                university: serverUser?.university || '',
                collegeDepartment: serverUser?.collegeDepartment || '',
                semester: serverUser?.semester || '',
                avatar: serverUser?.avatar || googleUser.picture || '',
                referralCode: serverUser?.referralCode || generateReferralCode(googleUser.email.split('@')[0]),
                coins: serverUser?.coins || 200,
                authProvider: 'google',
                isEmailVerified: true,
                createdAt: new Date().toISOString(),
              };

              await saveStoredProfile(profile);
            }
          }
        } catch (e) {
          if (__DEV__) console.warn('[GoogleCallback] Tab auth fallback error:', e);
        }
      }

      // Redirect back to main application
      const timer = setTimeout(() => {
        router.replace('/');
      }, 1200);
      return () => clearTimeout(timer);
    }

    processAuth();
  }, [router]);

  return (
    <View style={styles.container}>
      <AppIcon size={56} style={{ marginBottom: 20 }} />
      <ActivityIndicator size="large" color="#208AEF" />
      <Text style={styles.title}>{statusText}</Text>
      <Text style={styles.subtitle}>Please wait while AxiomByte verifies your account.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#020617',
    padding: 24,
  },
  title: {
    marginTop: 20,
    fontSize: 19,
    color: '#FFFFFF',
    fontFamily: 'TTFirsNeue-DemiBold',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: '#94A3B8',
    fontFamily: 'Neulis-Regular',
    textAlign: 'center',
  },
});
