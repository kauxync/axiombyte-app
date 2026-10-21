import React, { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider, Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider, useAppTheme } from '@/context/ThemeContext';
import { CurriculumProvider } from '@/context/CurriculumContext';

import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();
SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayoutContent() {
  const { resolvedTheme } = useAppTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <NavThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AuthProvider>
        <CurriculumProvider>
          <Slot />
        </CurriculumProvider>
      </AuthProvider>
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Clucks-Regular': require('@/assets/fonts/Clucks-Regular.otf'),
    'Clucks-Oblique': require('@/assets/fonts/Clucks-Oblique.otf'),
    'NeulisAlt-Regular': require('@/assets/fonts/NeulisAlt-Regular.otf'),
    'NeulisAlt-Medium': require('@/assets/fonts/NeulisAlt-Medium.otf'),
    'NeulisAlt-SemiBold': require('@/assets/fonts/NeulisAlt-SemiBold.otf'),
    'NeulisAlt-Bold': require('@/assets/fonts/NeulisAlt-Bold.otf'),
    'TTFirsNeue-Regular': require('@/assets/fonts/TT-Firs-Neue-Regular.ttf'),
    'TTFirsNeue-Medium': require('@/assets/fonts/TT-Firs-Neue-Medium.ttf'),
    'TTFirsNeue-DemiBold': require('@/assets/fonts/TT-Firs-Neue-DemiBold.ttf'),
    'TTFirsNeue-Bold': require('@/assets/fonts/TT-Firs-Neue-Bold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootLayoutContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
