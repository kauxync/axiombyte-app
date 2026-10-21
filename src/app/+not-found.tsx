import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

export default function NotFoundScreen() {
  const router = useRouter();

  const isOAuthRedirect =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    (window.location.href.includes('access_token=') ||
      window.location.href.includes('code=') ||
      window.location.href.includes('auth/google') ||
      window.location.href.includes('auth/github'));

  useEffect(() => {
    if (isOAuthRedirect) {
      try {
        WebBrowser.maybeCompleteAuthSession({ skipRedirectCheck: true });
      } catch {}
      const timer = setTimeout(() => {
        router.replace('/');
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isOAuthRedirect, router]);

  if (isOAuthRedirect) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#208AEF" />
        <Text style={styles.title}>Resolving Authentication...</Text>
        <Text style={styles.subtitle}>Connecting you to AxiomByte...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.code}>404</Text>
      <Text style={styles.title}>Page Not Found</Text>
      <Text style={styles.subtitle}>The requested screen could not be located.</Text>
      <TouchableOpacity style={styles.button} onPress={() => router.replace('/')} activeOpacity={0.8}>
        <Text style={styles.buttonText}>Go to Home</Text>
      </TouchableOpacity>
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
  code: {
    fontSize: 55,
    fontFamily: 'Clucks-Regular',
    color: '#208AEF',
    marginBottom: 8,
  },
  title: {
    fontSize: 21,
    fontFamily: 'TTFirsNeue-Bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'NeulisAlt-Regular',
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#208AEF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: 'NeulisAlt-SemiBold',
    fontSize: 16,
  },
});
