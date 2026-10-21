import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ScrollView,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { Fonts } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/context/ThemeContext';
import { useAlert } from '@/context/AlertContext';

interface OnboardingSlide {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  accentColor: string;
  highlightTag: string;
}

const SLIDES: OnboardingSlide[] = [
  {
    id: 'slide_1',
    badge: 'THE DUAL EPISTEMIC MODEL',
    title: 'Computer Science &\nMathematics, Unified',
    subtitle:
      'Computer Science is not just learning syntax—it is applied discrete mathematics. Learn algorithms, logic, and systems with mathematical rigor.',
    icon: 'git-merge',
    accentColor: '#818CF8',
    highlightTag: 'Formal Truth + Executable Code',
  },
  {
    id: 'slide_2',
    badge: 'VISUALIZE THE SYSTEM',
    title: 'Interactive C Memory &\nPointer Stepper',
    subtitle:
      'Pointers and memory addresses are no longer abstract. Watch stack allocations, dereferences, and memory mutate line-by-line.',
    icon: 'hardware-chip',
    accentColor: '#34D399',
    highlightTag: '0x7FFE04 • Real Addresses',
  },
  {
    id: 'slide_3',
    badge: 'STRUCTURED LEARNING',
    title: 'Prerequisite Roadmaps,\nNot Flat Checklists',
    subtitle:
      'Know what to learn first. Master C, then C++, while building foundations in Propositional Logic, Graph Theory, and Matrix Algebra.',
    icon: 'git-network',
    accentColor: '#FBBF24',
    highlightTag: 'Topological Prerequisite Trees',
  },
  {
    id: 'slide_4',
    badge: 'COMMUNITY REWARD ECONOMY',
    title: 'Invite Classmates,\nEarn Coins & Real INR',
    subtitle:
      'Earn 200 Coins for every friend you refer. 100 Coins = ₹1.00 INR. Redeem for study grants, pro tracks, or instant payouts!',
    icon: 'gift',
    accentColor: '#38BDF8',
    highlightTag: '1 Refer = 200 Coins (₹2.00)',
  },
];

export function OnboardingView({ onFinish }: { onFinish: () => void }) {
  const { showAlert } = useAlert();
  const [activeSlide, setActiveSlide] = useState(0);
  const [hasAgreedConsent, setHasAgreedConsent] = useState(false);
  const { completeOnboarding } = useAuth();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const flatListRef = useRef<FlatList<OnboardingSlide>>(null);

  // Responsive breakpoint calculations
  const isCompactHeight = height < 740;
  const isNarrowWidth = width < 380;
  const contentWidth = Math.min(width - 32, 540);

  const ringOuterSize = isCompactHeight ? 116 : 148;
  const ringInnerSize = isCompactHeight ? 80 : 102;
  const iconSize = isCompactHeight ? 46 : 58;

  const titleFontSize = isNarrowWidth ? 22 : isCompactHeight ? 24 : 28;
  const titleLineHeight = isNarrowWidth ? 28 : isCompactHeight ? 31 : 36;
  const subFontSize = isCompactHeight ? 13.5 : 15;
  const subLineHeight = isCompactHeight ? 19 : 22;

  const handleNext = async () => {
    if (activeSlide < SLIDES.length - 1) {
      const nextIdx = activeSlide + 1;
      flatListRef.current?.scrollToIndex({ index: nextIdx, animated: true });
      setActiveSlide(nextIdx);
    } else {
      if (!hasAgreedConsent) {
        showAlert(
          'Terms & Privacy Acceptance',
          'Please agree to the Terms of Service and Privacy Policy to create your computing workspace.',
          undefined,
          { type: 'warning', buttonText: 'I Understand' }
        );
        return;
      }
      await completeOnboarding();
      onFinish();
    }
  };

  const handlePrev = () => {
    if (activeSlide > 0) {
      const prevIdx = activeSlide - 1;
      flatListRef.current?.scrollToIndex({ index: prevIdx, animated: true });
      setActiveSlide(prevIdx);
    }
  };

  const handleSkip = async () => {
    // Jump to last slide to ensure consent is captured before completing
    const lastIdx = SLIDES.length - 1;
    flatListRef.current?.scrollToIndex({ index: lastIdx, animated: true });
    setActiveSlide(lastIdx);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(offsetX / width);
    if (pageIndex >= 0 && pageIndex < SLIDES.length && pageIndex !== activeSlide) {
      setActiveSlide(pageIndex);
    }
  };

  const goToSlide = (idx: number) => {
    flatListRef.current?.scrollToIndex({ index: idx, animated: true });
    setActiveSlide(idx);
  };

  const current = SLIDES[activeSlide];

  return (
    <View
      style={[
        styles.safeArea,
        {
          backgroundColor: colors.background,
          paddingTop: Math.max(insets.top, 16),
          paddingBottom: Math.max(insets.bottom, 20) + 10,
        },
      ]}>
      {/* Top Header with Skip and Logo */}
      <View style={styles.topBar}>
        <View style={styles.logoRow}>
          <View style={[styles.logoIcon, { backgroundColor: colors.primaryBg }]}>
            <Ionicons name="terminal" size={16} color={colors.primary} />
          </View>
          <Text style={[styles.logoText, { color: colors.text }]}>
            Axiom<Text style={{ color: colors.primary }}>Byte</Text>
          </Text>
        </View>
        {activeSlide < SLIDES.length - 1 ? (
          <Pressable onPress={handleSkip} style={styles.skipBtn} hitSlop={12}>
            <Text style={[styles.skipBtnText, { color: colors.textMuted }]}>Skip</Text>
          </Pressable>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      {/* Swipeable Slides via Hand / Gesture with responsive sizing */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        snapToInterval={width}
        snapToAlignment="center"
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleScroll}
        keyExtractor={(item) => item.id}
        style={styles.flatList}
        contentContainerStyle={{ flexGrow: 1 }}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
          }, 100);
        }}
        renderItem={({ item }) => (
          <View style={[styles.slideContainer, { width }]}>
            <ScrollView
              contentContainerStyle={[
                styles.slideScrollContent,
                { maxWidth: contentWidth },
              ]}
              showsVerticalScrollIndicator={false}
              bounces={false}>
              {/* Visual Icon Ring */}
              <View
                style={[
                  styles.slideHero,
                  { marginVertical: isCompactHeight ? 10 : 20 },
                ]}>
                <View
                  style={[
                    styles.iconRingLarge,
                    {
                      width: ringOuterSize,
                      height: ringOuterSize,
                      borderRadius: ringOuterSize / 2,
                      borderColor: item.accentColor,
                      backgroundColor: `${item.accentColor}12`,
                      marginBottom: isCompactHeight ? 12 : 18,
                    },
                  ]}>
                  <View
                    style={[
                      styles.iconRingInner,
                      {
                        width: ringInnerSize,
                        height: ringInnerSize,
                        borderRadius: ringInnerSize / 2,
                        backgroundColor: `${item.accentColor}25`,
                      },
                    ]}>
                    <Ionicons name={item.icon} size={iconSize} color={item.accentColor} />
                  </View>
                </View>

                <View
                  style={[
                    styles.highlightBadge,
                    {
                      borderColor: `${item.accentColor}40`,
                      backgroundColor: colors.card,
                    },
                  ]}>
                  <Ionicons name="sparkles" size={12} color={item.accentColor} />
                  <Text style={[styles.highlightText, { color: item.accentColor }]}>
                    {item.highlightTag}
                  </Text>
                </View>
              </View>

              {/* Content Section */}
              <View style={styles.textSection}>
                <Text style={[styles.badge, { color: item.accentColor }]}>
                  {item.badge}
                </Text>
                <Text
                  style={[
                    styles.title,
                    {
                      color: colors.text,
                      fontSize: titleFontSize,
                      lineHeight: titleLineHeight,
                    },
                  ]}>
                  {item.title}
                </Text>
                <Text
                  style={[
                    styles.subtitle,
                    {
                      color: colors.textSecondary,
                      fontSize: subFontSize,
                      lineHeight: subLineHeight,
                    },
                  ]}>
                  {item.subtitle}
                </Text>
              </View>
            </ScrollView>
          </View>
        )}
      />

      {/* Consent capture on final slide (GDPR / DPDP Compliance) */}
      {activeSlide === SLIDES.length - 1 && (
        <Pressable
          onPress={() => setHasAgreedConsent((prev) => !prev)}
          style={[
            styles.consentBox,
            {
              backgroundColor: colors.card,
              borderColor: hasAgreedConsent ? current.accentColor : colors.border,
            },
          ]}>
          <Ionicons
            name={hasAgreedConsent ? 'checkbox' : 'square-outline'}
            size={20}
            color={hasAgreedConsent ? current.accentColor : colors.textMuted}
          />
          <Text style={[styles.consentText, { color: colors.textSecondary }]}>
            I agree to {"AxiomByte's"}{' '}
            <Text style={{ color: current.accentColor, fontWeight: '700' }}>Terms of Service</Text>{' '}
            and{' '}
            <Text style={{ color: current.accentColor, fontWeight: '700' }}>Privacy Policy</Text>.
          </Text>
        </Pressable>
      )}

      {/* Footer with Prev / Touch Dots / Next Button */}
      <View style={styles.footer}>
        {/* Back button when not on first slide */}
        {activeSlide > 0 ? (
          <Pressable
            onPress={handlePrev}
            style={[
              styles.prevBtn,
              {
                backgroundColor: colors.cardSecondary,
                borderColor: colors.border,
              },
            ]}
            hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
        ) : (
          <View style={{ width: 44 }} />
        )}

        {/* Pagination Dots with direct click jump */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, idx) => (
            <Pressable
              key={idx}
              onPress={() => goToSlide(idx)}
              hitSlop={10}
              style={[
                styles.dot,
                { backgroundColor: isDark ? '#334155' : '#CBD5E1' },
                idx === activeSlide && [
                  styles.dotActive,
                  { backgroundColor: current.accentColor, width: 24 },
                ],
              ]}
            />
          ))}
        </View>

        {/* Next / Get Started Action Button */}
        <Pressable
          onPress={handleNext}
          style={[
            styles.nextBtn,
            { backgroundColor: current.accentColor },
          ]}>
          <Text style={styles.nextBtnText}>
            {activeSlide === SLIDES.length - 1 ? 'Get Started' : 'Next'}
          </Text>
          <Ionicons
            name={
              activeSlide === SLIDES.length - 1
                ? 'arrow-forward-circle'
                : 'chevron-forward'
            }
            size={18}
            color="#0F172A"
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontFamily: Fonts.heading,
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  skipBtnText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
    fontWeight: '600',
  },
  flatList: {
    flex: 1,
  },
  slideContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideScrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  slideHero: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRingLarge: {
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconRingInner: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  highlightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  highlightText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  textSection: {
    alignItems: 'center',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  badge: {
    fontFamily: Fonts.bodyBold,
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  title: {
    fontFamily: Fonts.heading,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: Fonts.body,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  prevBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    borderRadius: 4,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  nextBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  consentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 24,
    marginBottom: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  consentText: {
    fontFamily: Fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
    flex: 1,
  },
});
