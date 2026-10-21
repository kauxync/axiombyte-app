/**
 * Below are the colors and typography used in the app.
 */

import '@/global.css';

import { Platform } from 'react-native';

export interface AppThemeColors {
  background: string;
  card: string;
  cardSecondary: string;
  cardHover: string;
  border: string;
  borderSubtle: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryBg: string;
  accent: string;
  accentBg: string;
  success: string;
  warning: string;
  warningBg: string;
  error: string;
  errorBg: string;
  errorBorder: string;
  codeBg: string;
  inputBg: string;
  overlay: string;
}

export const ThemePalettes: { dark: AppThemeColors; light: AppThemeColors } = {
  dark: {
    background: '#020617', // Deep slate 950
    card: '#0F172A',       // Slate 900
    cardSecondary: '#1E293B', // Slate 800
    cardHover: '#334155',  // Slate 700
    border: '#334155',     // Slate 700
    borderSubtle: '#1E293B', // Slate 800
    text: '#F8FAFC',       // Slate 50
    textSecondary: '#94A3B8', // Slate 400
    textMuted: '#64748B',  // Slate 500
    primary: '#38BDF8',    // Sky 400
    primaryBg: 'rgba(56, 189, 248, 0.12)',
    accent: '#818CF8',     // Indigo 400
    accentBg: 'rgba(129, 140, 248, 0.12)',
    success: '#34D399',    // Emerald 400
    warning: '#F59E0B',    // Amber 500
    warningBg: 'rgba(245, 158, 11, 0.15)',
    error: '#F87171',      // Red 400
    errorBg: 'rgba(239, 68, 68, 0.16)',
    errorBorder: 'rgba(239, 68, 68, 0.35)',
    codeBg: '#090D16',
    inputBg: '#0F172A',
    overlay: 'rgba(0, 0, 0, 0.75)',
  },
  light: {
    background: '#F8FAFC', // Crisp Slate 50
    card: '#FFFFFF',       // Clean white card
    cardSecondary: '#F1F5F9', // Slate 100
    cardHover: '#E2E8F0',  // Slate 200
    border: '#E2E8F0',     // Slate 200
    borderSubtle: '#CBD5E1', // Slate 300
    text: '#0F172A',       // Slate 900
    textSecondary: '#475569', // Slate 600
    textMuted: '#64748B',  // Slate 500
    primary: '#0284C7',    // Sky 600
    primaryBg: 'rgba(2, 132, 199, 0.10)',
    accent: '#6366F1',     // Indigo 500
    accentBg: 'rgba(99, 102, 241, 0.10)',
    success: '#059669',    // Emerald 600
    warning: '#D97706',    // Amber 600
    warningBg: 'rgba(217, 119, 6, 0.12)',
    error: '#B91C1C',      // Deep Red 700 - high contrast WCAG AAA on light background
    errorBg: '#FEF2F2',    // Red 50 soft tint
    errorBorder: '#FCA5A5', // Red 300
    codeBg: '#0F172A',     // Keep code block dark for readability
    inputBg: '#FFFFFF',
    overlay: 'rgba(15, 23, 42, 0.60)',
  },
};

export const Colors = {
  light: {
    text: '#0F172A',
    background: '#F8FAFC',
    backgroundElement: '#F1F5F9',
    backgroundSelected: '#E2E8F0',
    textSecondary: '#475569',
  },
  dark: {
    text: '#F8FAFC',
    background: '#020617',
    backgroundElement: '#0F172A',
    backgroundSelected: '#1E293B',
    textSecondary: '#94A3B8',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = {
  /** Headings: TT Firs Neue typography across weights */
  heading: Platform.select({
    web: "'TTFirsNeue-Bold', 'TTFirsNeue', sans-serif",
    default: 'TTFirsNeue-Bold',
  }),
  headingDemiBold: Platform.select({
    web: "'TTFirsNeue-DemiBold', 'TTFirsNeue', sans-serif",
    default: 'TTFirsNeue-DemiBold',
  }),
  headingMedium: Platform.select({
    web: "'TTFirsNeue-Medium', 'TTFirsNeue', sans-serif",
    default: 'TTFirsNeue-Medium',
  }),
  headingOblique: Platform.select({
    web: "'TTFirsNeue-DemiBold', 'TTFirsNeue', sans-serif",
    default: 'TTFirsNeue-DemiBold',
  }),

  /** Body: Neulis Alt typography across weights */
  body: Platform.select({
    web: "'NeulisAlt-Regular', sans-serif",
    default: 'NeulisAlt-Regular',
  }),
  bodyMedium: Platform.select({
    web: "'NeulisAlt-Medium', sans-serif",
    default: 'NeulisAlt-Medium',
  }),
  bodyDemiBold: Platform.select({
    web: "'NeulisAlt-SemiBold', sans-serif",
    default: 'NeulisAlt-SemiBold',
  }),
  bodyBold: Platform.select({
    web: "'NeulisAlt-Bold', sans-serif",
    default: 'NeulisAlt-Bold',
  }),
  sans: Platform.select({
    web: "'NeulisAlt-Regular', sans-serif",
    default: 'NeulisAlt-Regular',
  }),

  /** Code / Monospace */
  mono: Platform.select({
    ios: 'ui-monospace',
    android: 'monospace',
    web: 'var(--font-mono, monospace)',
    default: 'monospace',
  }),
};

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
