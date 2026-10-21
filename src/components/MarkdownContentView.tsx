import React from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Fonts } from '@/constants/theme';

interface MarkdownContentViewProps {
  content: string;
  colors: any;
  isDark: boolean;
  accentColor: string;
  onOpenCodeLab: (codeId: string) => void;
}

export function MarkdownContentView({
  content,
  colors,
  isDark,
  accentColor,
  onOpenCodeLab,
}: MarkdownContentViewProps) {
  // Parse markdown content line-by-line into blocks
  const blocks = parseMarkdownBlocks(content);

  const handleCopy = async (code: string) => {
    try {
      await Clipboard.setStringAsync(code);
      Alert.alert('Copied', 'Code snippet copied to clipboard.');
    } catch {
      Alert.alert('Notice', 'Unable to copy snippet to clipboard.');
    }
  };

  return (
    <View style={styles.container}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'h1':
            return (
              <Text key={idx} style={[styles.h1, { color: colors.text }]}>
                {block.text}
              </Text>
            );

          case 'h2':
            return (
              <Text key={idx} style={[styles.h2, { color: colors.text }]}>
                {block.text}
              </Text>
            );

          case 'h3':
            return (
              <View key={idx} style={styles.h3Container}>
                <View style={[styles.h3AccentBar, { backgroundColor: accentColor }]} />
                <Text style={[styles.h3, { color: colors.text }]}>{block.text}</Text>
              </View>
            );

          case 'list_item':
            return (
              <View key={idx} style={styles.listItemRow}>
                <Text style={[styles.bulletDot, { color: accentColor }]}>•</Text>
                <Text style={[styles.listItemText, { color: colors.textSecondary }]}>
                  {renderFormattedInline(block.text, colors)}
                </Text>
              </View>
            );

          case 'code_block':
            return (
              <View
                key={idx}
                style={[
                  styles.codeCard,
                  { backgroundColor: isDark ? '#090D16' : '#1E293B', borderColor: colors.border },
                ]}>
                <View style={styles.codeHeader}>
                  <View style={styles.codeLangBadge}>
                    <Ionicons name="code-slash" size={13} color="#38BDF8" />
                    <Text style={styles.codeLangText}>
                      {(block.lang || 'c').toUpperCase()}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleCopy(block.code)}
                    hitSlop={6}
                    style={styles.copyBtn}>
                    <Ionicons name="copy-outline" size={13} color="#94A3B8" />
                    <Text style={styles.copyBtnText}>Copy</Text>
                  </Pressable>
                </View>
                <Text style={styles.codeText}>{block.code}</Text>
              </View>
            );

          case 'codelab_button':
            return (
              <Pressable
                key={idx}
                onPress={() => onOpenCodeLab(block.codeId)}
                style={({ pressed }) => [
                  styles.codelabTriggerBtn,
                  {
                    backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(56, 189, 248, 0.16)',
                    borderColor: '#38BDF8',
                  },
                  pressed && { opacity: 0.8, transform: [{ scale: 0.99 }] },
                ]}>
                <View style={styles.codelabTriggerLeft}>
                  <View style={styles.flashIconCircle}>
                    <Ionicons name="flash" size={15} color="#0284C7" />
                  </View>
                  <View>
                    <Text style={[styles.codelabTriggerTitle, { color: isDark ? '#38BDF8' : '#0369A1' }]}>
                      Try it / How it works
                    </Text>
                    <Text style={[styles.codelabTriggerSub, { color: colors.textMuted }]}>
                      Inspect live execution, memory state & explanation
                    </Text>
                  </View>
                </View>
                <View style={styles.upArrowCircle}>
                  <Ionicons name="chevron-up" size={16} color={isDark ? '#38BDF8' : '#0369A1'} />
                </View>
              </Pressable>
            );

          case 'paragraph':
          default:
            return (
              <Text key={idx} style={[styles.paragraph, { color: colors.textSecondary }]}>
                {renderFormattedInline(block.text, colors)}
              </Text>
            );
        }
      })}
    </View>
  );
}

// Helpers for block parsing
interface Block {
  type: 'h1' | 'h2' | 'h3' | 'paragraph' | 'list_item' | 'code_block' | 'codelab_button';
  text: string;
  lang?: string;
  code: string;
  codeId: string;
}

function parseMarkdownBlocks(content: string): Block[] {
  const lines = content.split('\n');
  const blocks: Block[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeLang = '';

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Fenced Code Block Toggle
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        blocks.push({
          type: 'code_block',
          text: '',
          code: codeBuffer.join('\n'),
          lang: codeLang || 'c',
          codeId: '',
        });
        inCodeBlock = false;
        codeBuffer = [];
        codeLang = '';
      } else {
        inCodeBlock = true;
        codeLang = trimmed.replace('```', '').trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(rawLine);
      continue;
    }

    if (trimmed === '') continue;

    // Check for "Try it / How it works" link/button
    // Examples: [Try it / How it works](codelab:c_apps_intro)
    // or [Try it or How it works](codelab:c_apps_intro)
    // or [How it works](codelab:c_apps_intro)
    const codelabMatch = trimmed.match(/\[.*?\]\((?:codelab:|\/codelab\/|codelab:\/\/)?([a-zA-Z0-9_-]+)\)/i);
    if (codelabMatch) {
      blocks.push({
        type: 'codelab_button',
        text: '',
        code: '',
        codeId: codelabMatch[1],
      });
      continue;
    }

    // Headings
    if (trimmed.startsWith('# ')) {
      blocks.push({
        type: 'h1',
        text: trimmed.replace(/^#\s+/, ''),
        code: '',
        codeId: '',
      });
      continue;
    }

    if (trimmed.startsWith('## ')) {
      blocks.push({
        type: 'h2',
        text: trimmed.replace(/^##\s+/, ''),
        code: '',
        codeId: '',
      });
      continue;
    }

    if (trimmed.startsWith('### ')) {
      blocks.push({
        type: 'h3',
        text: trimmed.replace(/^###\s+/, ''),
        code: '',
        codeId: '',
      });
      continue;
    }

    // Bullet List Items
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      blocks.push({
        type: 'list_item',
        text: trimmed.replace(/^[*•-]\s+/, ''),
        code: '',
        codeId: '',
      });
      continue;
    }

    // Normal paragraph
    blocks.push({
      type: 'paragraph',
      text: trimmed,
      code: '',
      codeId: '',
    });
  }

  // Handle trailing unclosed code block safely
  if (inCodeBlock && codeBuffer.length > 0) {
    blocks.push({
      type: 'code_block',
      text: '',
      code: codeBuffer.join('\n'),
      lang: codeLang || 'c',
      codeId: '',
    });
  }

  return blocks;
}

// Basic inline text formatting (bold **text**, inline `code`)
function renderFormattedInline(text: string, colors: any) {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Text key={index} style={{ fontFamily: Fonts.heading, fontWeight: '700', color: colors.text }}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <Text
          key={index}
          style={{
            fontFamily: Fonts.mono,
            backgroundColor: colors.cardSecondary,
            color: colors.primary,
          }}>
          {` ${part.slice(1, -1)} `}
        </Text>
      );
    }
    return <Text key={index}>{part}</Text>;
  });
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  h1: {
    fontFamily: Fonts.heading,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  h2: {
    fontFamily: Fonts.heading,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    letterSpacing: -0.3,
    marginTop: 8,
  },
  h3Container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  h3AccentBar: {
    width: 3,
    height: 16,
    borderRadius: 2,
  },
  h3: {
    fontFamily: Fonts.headingDemiBold,
    fontSize: 15,
    letterSpacing: -0.2,
  },
  paragraph: {
    fontFamily: Fonts.body,
    fontSize: 15,
    lineHeight: 23,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingLeft: 4,
  },
  bulletDot: {
    fontSize: 18,
    lineHeight: 22,
  },
  listItemText: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 14,
    lineHeight: 21,
  },
  codeCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 4,
    marginBottom: 6,
  },
  codeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  codeLangBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codeLangText: {
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
  codeText: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    lineHeight: 20,
    color: '#E2E8F0',
    padding: 14,
  },
  codelabTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    marginVertical: 6,
  },
  codelabTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  flashIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  codelabTriggerTitle: {
    fontFamily: Fonts.heading,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  codelabTriggerSub: {
    fontFamily: Fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
  upArrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
