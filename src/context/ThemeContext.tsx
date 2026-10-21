import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemePalettes, AppThemeColors } from '@/constants/theme';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ActiveTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = '@learn_kauxync_theme_mode';

interface ThemeContextType {
  themeMode: ThemeMode;
  resolvedTheme: ActiveTheme;
  isDark: boolean;
  colors: AppThemeColors;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  cycleTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useRNColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    async function loadTheme() {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'system' || saved === 'light' || saved === 'dark') {
          setThemeModeState(saved as ThemeMode);
        }
      } catch (err) {
        console.error('Failed to load theme preference', err);
      }
    }
    loadTheme();
  }, []);

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      setThemeModeState(mode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (err) {
      console.error('Failed to save theme mode', err);
    }
  };

  const cycleTheme = async () => {
    // Cycles system -> light -> dark -> system
    const order: ThemeMode[] = ['system', 'light', 'dark'];
    const currentIndex = order.indexOf(themeMode);
    const nextIndex = (currentIndex + 1) % order.length;
    await setThemeMode(order[nextIndex]);
  };

  const resolvedTheme: ActiveTheme =
    themeMode === 'system'
      ? systemColorScheme === 'light'
        ? 'light'
        : 'dark'
      : themeMode;

  const isDark = resolvedTheme === 'dark';
  const colors = ThemePalettes[resolvedTheme];

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        resolvedTheme,
        isDark,
        colors,
        setThemeMode,
        cycleTheme,
      }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return context;
}
