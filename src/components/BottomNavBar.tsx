import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/context/ThemeContext';
import { Fonts } from '@/constants/theme';

export type AppTab = 'home' | 'roadmaps' | 'math' | 'profile';

interface NavItem {
  key: AppTab;
  label: string;
  iconOutline: keyof typeof Ionicons.glyphMap;
  iconFilled: keyof typeof Ionicons.glyphMap;
}

const NAV_ITEMS: NavItem[] = [
  {
    key: 'home',
    label: 'Home',
    iconOutline: 'home-outline',
    iconFilled: 'home',
  },
  {
    key: 'roadmaps',
    label: 'Roadmaps',
    iconOutline: 'map-outline',
    iconFilled: 'map',
  },
  {
    key: 'math',
    label: 'Subjects Notes',
    iconOutline: 'book-outline',
    iconFilled: 'book',
  },
  {
    key: 'profile',
    label: 'Profile',
    iconOutline: 'person-outline',
    iconFilled: 'person',
  },
];

interface BottomNavBarProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

export function BottomNavBar({ activeTab, onTabChange }: BottomNavBarProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  // Bottom padding to clear system home indicator / gesture bar
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 14 : 10);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: bottomPadding,
        },
      ]}>
      <View style={styles.tabRow}>
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.key;
          const iconName = isActive ? item.iconFilled : item.iconOutline;
          const iconColor = isActive ? colors.primary : colors.textMuted;

          return (
            <Pressable
              key={item.key}
              onPress={() => onTabChange(item.key)}
              style={({ pressed }) => [
                styles.tabItem,
                pressed && { opacity: 0.75 },
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={item.label}>
              <View style={styles.iconContainer}>
                {isActive && (
                  <View
                    style={[
                      styles.activeIndicator,
                      {
                        backgroundColor: colors.primaryBg,
                        borderColor: `${colors.primary}35`,
                      },
                    ]}
                  />
                )}
                <Ionicons name={iconName} size={22} color={iconColor} />
              </View>

              <Text
                style={[
                  styles.tabLabel,
                  { color: colors.textMuted },
                  isActive && [
                    styles.tabLabelActive,
                    { color: colors.primary },
                  ],
                ]}
                numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingTop: 8,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  tabRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  iconContainer: {
    position: 'relative',
    width: 44,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeIndicator: {
    position: 'absolute',
    width: 40,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
  },
  tabLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  tabLabelActive: {
    fontFamily: Fonts.bodyBold,
    fontWeight: '700',
  },
});

