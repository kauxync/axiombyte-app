import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CodeLabModalData } from '@/data/roadmaps/types';

interface CodeLabModalProps {
  visible: boolean;
  codeLabData: CodeLabModalData | null;
  isLoading: boolean;
  onClose: () => void;
  onOpenInCodeLab?: (code: string, language: string) => void;
  colors: any;
  isDark: boolean;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function CodeLabModal({
  visible,
  codeLabData,
  isLoading,
  onClose,
  onOpenInCodeLab,
  colors,
  isDark,
}: CodeLabModalProps) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'code' | 'howItWorks'>('code');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!codeLabData?.code) return;
    setCopied(true);
    Alert.alert('Copied', 'Source code copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Backdrop tap to close */}
        <Pressable style={styles.backdropPressable} onPress={onClose} />

        {/* Down-to-Up Modal Card */}
        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 16) + 12,
            },
          ]}>
          {/* Grab Bar Indicator */}
          <View style={styles.grabBarRow}>
            <View style={[styles.grabBar, { backgroundColor: colors.border }]} />
          </View>

          {/* Modal Header */}
          <View style={[styles.headerRow, { borderBottomColor: colors.borderSubtle }]}>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Ionicons name="flash" size={17} color="#38BDF8" />
                <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                  {codeLabData?.title || 'How It Works & Live Execution'}
                </Text>
              </View>
              {codeLabData?.codeId && (
                <View style={styles.badgeRow}>
                  <View style={[styles.codeIdBadge, { backgroundColor: colors.cardSecondary }]}>
                    <Text style={[styles.codeIdText, { color: colors.primary }]}>
                      ID: {codeLabData.codeId}
                    </Text>
                  </View>
                  <Text style={[styles.langText, { color: colors.textMuted }]}>
                    {(codeLabData.language || 'c').toUpperCase()}
                  </Text>
                </View>
              )}
            </View>

            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={[styles.closeBtn, { backgroundColor: colors.cardSecondary }]}>
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>

          {/* Segment Tab Selector */}
          <View style={[styles.tabBar, { backgroundColor: colors.cardSecondary }]}>
            <Pressable
              onPress={() => setActiveTab('code')}
              style={[
                styles.tabBtn,
                activeTab === 'code' && [styles.activeTabBtn, { backgroundColor: colors.card }],
              ]}>
              <Ionicons
                name="code-slash"
                size={14}
                color={activeTab === 'code' ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === 'code' ? colors.text : colors.textMuted },
                ]}>
                Live Code & Output
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab('howItWorks')}
              style={[
                styles.tabBtn,
                activeTab === 'howItWorks' && [styles.activeTabBtn, { backgroundColor: colors.card }],
              ]}>
              <Ionicons
                name="bulb-outline"
                size={14}
                color={activeTab === 'howItWorks' ? '#F59E0B' : colors.textMuted}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === 'howItWorks' ? colors.text : colors.textMuted },
                ]}>
                How It Works ({codeLabData?.howItWorks?.length || 0})
              </Text>
            </Pressable>
          </View>

          {/* Body Content */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textMuted }]}>
                Loading execution sandbox...
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.sheetScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}>
              {activeTab === 'code' ? (
                <>
                  {/* Source Code Container */}
                  <View style={[styles.codeBox, { backgroundColor: isDark ? '#090D16' : '#1E293B' }]}>
                    <View style={styles.codeBoxHeader}>
                      <View style={styles.codeBoxLang}>
                        <Ionicons name="terminal-outline" size={13} color="#38BDF8" />
                        <Text style={styles.codeBoxLangText}>
                          {(codeLabData?.language || 'c').toUpperCase()} Source
                        </Text>
                      </View>
                      <Pressable onPress={handleCopy} style={styles.copyBtn}>
                        <Ionicons
                          name={copied ? 'checkmark' : 'copy-outline'}
                          size={13}
                          color="#94A3B8"
                        />
                        <Text style={styles.copyBtnText}>{copied ? 'Copied' : 'Copy'}</Text>
                      </Pressable>
                    </View>
                    <Text style={styles.sourceCodeText}>{codeLabData?.code || '// No code'}</Text>
                  </View>

                  {/* Terminal Execution Output */}
                  <View style={[styles.outputBox, { backgroundColor: isDark ? '#020617' : '#0F172A' }]}>
                    <View style={styles.outputHeader}>
                      <View style={styles.trafficLights}>
                        <View style={[styles.light, { backgroundColor: '#EF4444' }]} />
                        <View style={[styles.light, { backgroundColor: '#F59E0B' }]} />
                        <View style={[styles.light, { backgroundColor: '#10B981' }]} />
                      </View>
                      <Text style={styles.outputTitle}>Terminal stdout</Text>
                    </View>
                    <Text style={styles.outputText}>
                      {codeLabData?.output || 'No output produced.'}
                    </Text>
                  </View>
                </>
              ) : (
                /* How It Works Steps */
                <View style={styles.howItWorksList}>
                  {codeLabData?.howItWorks && codeLabData.howItWorks.length > 0 ? (
                    codeLabData.howItWorks.map((step, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.stepItem,
                          { backgroundColor: colors.cardSecondary, borderColor: colors.borderSubtle },
                        ]}>
                        <View style={styles.stepNumBadge}>
                          <Text style={styles.stepNumText}>{idx + 1}</Text>
                        </View>
                        <Text style={[styles.stepText, { color: colors.text }]}>{step}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                      Step-by-step breakdown is not available for this snippet.
                    </Text>
                  )}
                </View>
              )}
            </ScrollView>
          )}

          {/* Bottom Actions */}
          <View style={styles.footerRow}>
            {onOpenInCodeLab && (
              <Pressable
                onPress={() => {
                  onClose();
                  if (codeLabData) {
                    onOpenInCodeLab(codeLabData.code, codeLabData.language || 'c');
                  }
                }}
                style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}>
                <Ionicons name="play" size={16} color="#FFFFFF" />
                <Text style={styles.primaryActionText}>Open in Code Lab</Text>
              </Pressable>
            )}
            <Pressable
              onPress={onClose}
              style={[
                styles.dismissBtn,
                !onOpenInCodeLab && { flex: 1 },
                { backgroundColor: colors.cardSecondary, borderColor: colors.border },
              ]}>
              <Text style={[styles.dismissBtnText, { color: colors.text }]}>Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  backdropPressable: {
    flex: 1,
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: SCREEN_HEIGHT * 0.88,
    minHeight: SCREEN_HEIGHT * 0.55,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 20,
  },
  grabBarRow: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  grabBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontFamily: Fonts.heading,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  codeIdBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  codeIdText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '600',
  },
  langText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    marginTop: 12,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  activeTabBtn: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabBtnText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    fontWeight: '600',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: Fonts.body,
    fontSize: 14,
  },
  sheetScroll: {
    flex: 1,
  },
  codeBox: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  codeBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  codeBoxLang: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codeBoxLangText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  copyBtnText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11,
    color: '#94A3B8',
  },
  sourceCodeText: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: '#E2E8F0',
    lineHeight: 20,
    padding: 14,
  },
  outputBox: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  outputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  trafficLights: {
    flexDirection: 'row',
    gap: 4,
  },
  light: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  outputTitle: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: '#64748B',
    textTransform: 'uppercase',
  },
  outputText: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: '#10B981',
    lineHeight: 18,
  },
  howItWorksList: {
    gap: 10,
    paddingTop: 4,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  stepNumBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    fontFamily: Fonts.heading,
    fontSize: 12,
    fontWeight: '700',
    color: '#F59E0B',
  },
  stepText: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  primaryActionText: {
    fontFamily: Fonts.headingDemiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  dismissBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtnText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    fontWeight: '600',
  },
});
