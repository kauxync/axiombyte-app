import React from 'react';
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native';
import { Fonts } from '@/constants/theme';
import { InteractiveCodeCard, checkNoRun } from './InteractiveCodeCard';

interface MarkdownContentViewProps {
  content: string;
  colors: any;
  isDark: boolean;
  accentColor: string;
}

export function MarkdownContentView({
  content,
  colors,
  isDark,
  accentColor,
}: MarkdownContentViewProps) {
  // Parse markdown content line-by-line into blocks
  const blocks = parseMarkdownBlocks(content);

  return (
    <View style={styles.container}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'h1':
            return (
              <Text key={idx} style={[styles.h1, { color: colors.text }]}>
                {renderFormattedInline(block.text, colors, isDark)}
              </Text>
            );

          case 'h2':
            return (
              <Text key={idx} style={[styles.h2, { color: colors.text }]}>
                {renderFormattedInline(block.text, colors, isDark)}
              </Text>
            );

          case 'h3':
            return (
              <View key={idx} style={styles.h3Container}>
                <View style={[styles.h3AccentBar, { backgroundColor: accentColor }]} />
                <Text style={[styles.h3, { color: colors.text }]}>
                  {renderFormattedInline(block.text, colors, isDark)}
                </Text>
              </View>
            );

          case 'h4':
            return (
              <Text key={idx} style={[styles.h4, { color: colors.text }]}>
                {renderFormattedInline(block.text, colors, isDark)}
              </Text>
            );

          case 'list_item':
            return (
              <View key={idx} style={styles.listItemRow}>
                <Text style={[styles.bulletDot, { color: accentColor }]}>•</Text>
                <Text style={[styles.listItemText, { color: colors.textSecondary }]}>
                  {renderFormattedInline(block.text, colors, isDark)}
                </Text>
              </View>
            );

          case 'numbered_list':
            return (
              <View key={idx} style={styles.listItemRow}>
                <Text style={[styles.numberBullet, { color: accentColor }]}>{block.num}.</Text>
                <Text style={[styles.listItemText, { color: colors.textSecondary }]}>
                  {renderFormattedInline(block.text, colors, isDark)}
                </Text>
              </View>
            );

          case 'blockquote':
            return (
              <View
                key={idx}
                style={[
                  styles.blockquote,
                  {
                    borderLeftColor: accentColor,
                    backgroundColor: isDark
                      ? 'rgba(56, 189, 248, 0.08)'
                      : 'rgba(56, 189, 248, 0.06)',
                  },
                ]}>
                <Text style={[styles.blockquoteText, { color: colors.textSecondary }]}>
                  {renderFormattedInline(block.text, colors, isDark)}
                </Text>
              </View>
            );

          case 'hr':
            return (
              <View
                key={idx}
                style={[
                  styles.hr,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255, 255, 255, 0.12)'
                      : 'rgba(0, 0, 0, 0.1)',
                  },
                ]}
              />
            );

          case 'table':
            return (
              <View key={idx} style={styles.tableWrapper}>
                <ScrollView
                  horizontal={true}
                  showsHorizontalScrollIndicator={true}
                  contentContainerStyle={styles.tableScrollContent}>
                  <View
                    style={[
                      styles.table,
                      {
                        borderColor: isDark
                          ? 'rgba(255, 255, 255, 0.12)'
                          : 'rgba(0, 0, 0, 0.12)',
                        backgroundColor: isDark ? '#0A0F1D' : '#F8FAFC',
                      },
                    ]}>
                    {/* Header Row */}
                    {block.headers && block.headers.length > 0 && (
                      <View
                        style={[
                          styles.tableHeaderRow,
                          {
                            backgroundColor: isDark ? '#141E33' : '#E2E8F0',
                            borderBottomColor: isDark
                              ? 'rgba(255, 255, 255, 0.12)'
                              : 'rgba(0, 0, 0, 0.12)',
                          },
                        ]}>
                        {block.headers.map((h, hIdx) => (
                          <View
                            key={hIdx}
                            style={[
                              styles.tableCell,
                              styles.tableHeaderCell,
                              hIdx < block.headers!.length - 1 && {
                                borderRightWidth: 1,
                                borderRightColor: isDark
                                  ? 'rgba(255, 255, 255, 0.1)'
                                  : 'rgba(0, 0, 0, 0.08)',
                              },
                            ]}>
                            <Text style={[styles.tableHeaderText, { color: colors.text }]}>
                              {renderFormattedInline(h, colors, isDark)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Data Rows */}
                    {block.rows &&
                      block.rows.map((row, rIdx) => {
                        const isEven = rIdx % 2 === 0;
                        return (
                          <View
                            key={rIdx}
                            style={[
                              styles.tableRow,
                              {
                                backgroundColor: isEven
                                  ? isDark
                                    ? '#0D1424'
                                    : '#FFFFFF'
                                  : isDark
                                  ? '#090D18'
                                  : '#F1F5F9',
                                borderBottomWidth: rIdx < block.rows!.length - 1 ? 1 : 0,
                                borderBottomColor: isDark
                                  ? 'rgba(255, 255, 255, 0.08)'
                                  : 'rgba(0, 0, 0, 0.06)',
                              },
                            ]}>
                            {row.map((cell, cIdx) => (
                              <View
                                key={cIdx}
                                style={[
                                  styles.tableCell,
                                  cIdx < row.length - 1 && {
                                    borderRightWidth: 1,
                                    borderRightColor: isDark
                                      ? 'rgba(255, 255, 255, 0.08)'
                                      : 'rgba(0, 0, 0, 0.06)',
                                  },
                                ]}>
                                <Text
                                  style={[
                                    styles.tableCellText,
                                    { color: colors.textSecondary },
                                  ]}>
                                  {renderFormattedInline(cell, colors, isDark)}
                                </Text>
                              </View>
                            ))}
                          </View>
                        );
                      })}
                  </View>
                </ScrollView>
              </View>
            );

          case 'code_block':
            return (
              <InteractiveCodeCard
                key={idx}
                initialCode={block.code}
                language={block.lang || 'c'}
                noRun={block.noRun}
                colors={colors}
                isDark={isDark}
                accentColor={accentColor}
              />
            );

          case 'paragraph':
          default:
            return (
              <Text key={idx} style={[styles.paragraph, { color: colors.textSecondary }]}>
                {renderFormattedInline(block.text, colors, isDark)}
              </Text>
            );
        }
      })}
    </View>
  );
}

// Helpers for block parsing
interface Block {
  type:
    | 'h1'
    | 'h2'
    | 'h3'
    | 'h4'
    | 'paragraph'
    | 'list_item'
    | 'numbered_list'
    | 'code_block'
    | 'table'
    | 'blockquote'
    | 'hr';
  text: string;
  lang?: string;
  code: string;
  noRun?: boolean;
  headers?: string[];
  rows?: string[][];
  num?: string;
}

// Strips HTML comments (<!-- ... -->) outside fenced code blocks so editorial/metadata comments do not display
function stripHtmlCommentsOutsideCodeBlocks(content: string): string {
  const codeBlockRegex = /```[\s\S]*?(?:```|$)/g;
  let lastIndex = 0;
  let result = '';
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const textBefore = content.substring(lastIndex, match.index);
    result += textBefore.replace(/<!--[\s\S]*?-->/g, '');
    result += match[0];
    lastIndex = match.index + match[0].length;
  }

  const remainder = content.substring(lastIndex);
  result += remainder.replace(/<!--[\s\S]*?-->/g, '');

  return result;
}

function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2;
}

function parseCells(line: string): string[] {
  let str = line.trim();
  if (str.startsWith('|')) str = str.substring(1);
  if (str.endsWith('|')) str = str.substring(0, str.length - 1);
  return str.split('|').map((c) => c.trim());
}

function isDividerRow(cells: string[]): boolean {
  if (cells.length === 0) return false;
  return cells.every((c) => /^:?-+:?$/.test(c.trim()));
}

function parseMarkdownBlocks(content: string): Block[] {
  const sanitizedContent = stripHtmlCommentsOutsideCodeBlocks(content);
  const lines = sanitizedContent.split('\n');
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
        const { isNoRun, cleanLang } = checkNoRun(codeLang);

        blocks.push({
          type: 'code_block',
          text: '',
          code: codeBuffer.join('\n'),
          lang: cleanLang,
          noRun: isNoRun,
        });
        inCodeBlock = false;
        codeBuffer = [];
        codeLang = '';
      } else {
        inCodeBlock = true;
        codeLang = trimmed.replace(/^`+/, '').trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(rawLine);
      continue;
    }

    if (trimmed === '') continue;

    // Filter out any legacy codelab links from markdown
    if (/\[.*?\]\((?:codelab:|\/codelab\/|codelab:\/\/)?([a-zA-Z0-9_-]+)\)/i.test(trimmed)) {
      continue;
    }

    // Horizontal Rule
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({
        type: 'hr',
        text: '',
        code: '',
      });
      continue;
    }

    // Markdown Table Detection
    if (isTableRow(trimmed)) {
      const tableLines: string[] = [];
      while (i < lines.length && isTableRow(lines[i].trim())) {
        tableLines.push(lines[i].trim());
        i++;
      }
      i--; // Adjust index

      if (tableLines.length > 0) {
        const rawHeaders = parseCells(tableLines[0]);
        const headers: string[] = rawHeaders;
        const rows: string[][] = [];
        let startIdx = 1;

        if (tableLines.length > 1) {
          const secondRowCells = parseCells(tableLines[1]);
          if (isDividerRow(secondRowCells)) {
            startIdx = 2;
          }
        }

        for (let r = startIdx; r < tableLines.length; r++) {
          rows.push(parseCells(tableLines[r]));
        }

        blocks.push({
          type: 'table',
          text: '',
          code: '',
          headers,
          rows,
        });
        continue;
      }
    }

    // Blockquote Detection (groups multiple consecutive blockquote lines)
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      i--; // Adjust index
      blocks.push({
        type: 'blockquote',
        text: quoteLines.join('\n'),
        code: '',
      });
      continue;
    }

    // Headings
    if (trimmed.startsWith('# ')) {
      blocks.push({
        type: 'h1',
        text: trimmed.replace(/^#\s+/, ''),
        code: '',
      });
      continue;
    }

    if (trimmed.startsWith('## ')) {
      blocks.push({
        type: 'h2',
        text: trimmed.replace(/^##\s+/, ''),
        code: '',
      });
      continue;
    }

    if (trimmed.startsWith('### ')) {
      blocks.push({
        type: 'h3',
        text: trimmed.replace(/^###\s+/, ''),
        code: '',
      });
      continue;
    }

    if (trimmed.startsWith('#### ')) {
      blocks.push({
        type: 'h4',
        text: trimmed.replace(/^####\s+/, ''),
        code: '',
      });
      continue;
    }

    // Numbered List Items
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      blocks.push({
        type: 'numbered_list',
        text: numMatch[2],
        num: numMatch[1],
        code: '',
      });
      continue;
    }

    // Bullet List Items
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      blocks.push({
        type: 'list_item',
        text: trimmed.replace(/^[*•-]\s+/, ''),
        code: '',
      });
      continue;
    }

    // Normal paragraph
    blocks.push({
      type: 'paragraph',
      text: trimmed,
      code: '',
    });
  }

  // Handle trailing unclosed code block safely
  if (inCodeBlock && codeBuffer.length > 0) {
    const { isNoRun, cleanLang } = checkNoRun(codeLang);

    blocks.push({
      type: 'code_block',
      text: '',
      code: codeBuffer.join('\n'),
      lang: cleanLang,
      noRun: isNoRun,
    });
  }

  return blocks;
}

function isSafeUrl(url?: string): boolean {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('mailto:')
  );
}

// Inline text formatting: links [text](url), bold **text**, inline `code`, italic *text* or _text_
function renderFormattedInline(text: string, colors: any, isDark: boolean) {
  const parts = text.split(
    /(\[.+?\]\(.+?\)|(?:\*\*|__)(?:.+?)(?:\*\*|__)|`[^`]+`|\*(?:[^*]+)\*|_(?:[^_]+)_)/g
  );

  return parts.map((part, index) => {
    // 1. Clickable Link: [text](url) with safe URL validation (blocks javascript:, file:, data: schemes)
    if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
      const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
      if (linkMatch) {
        const [, linkText, linkUrl] = linkMatch;
        const safe = isSafeUrl(linkUrl);
        return (
          <Text
            key={index}
            onPress={() => {
              if (safe) {
                Linking.openURL(linkUrl.trim()).catch(() => {});
              }
            }}
            style={{
              color: safe ? colors.primary : colors.textMuted,
              textDecorationLine: safe ? 'underline' : 'none',
              fontFamily: Fonts.bodyMedium,
              fontWeight: '600',
            }}>
            {linkText}
          </Text>
        );
      }
    }

    // 2. Bold text: **bold** or __bold__
    if (
      (part.startsWith('**') && part.endsWith('**')) ||
      (part.startsWith('__') && part.endsWith('__'))
    ) {
      return (
        <Text
          key={index}
          style={{
            fontFamily: Fonts.headingDemiBold,
            fontWeight: '700',
            color: colors.text,
          }}>
          {part.slice(2, -2)}
        </Text>
      );
    }

    // 3. Inline code: `code`
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <Text
          key={index}
          style={{
            fontFamily: Fonts.mono,
            fontSize: 13,
            backgroundColor: isDark
              ? 'rgba(255, 255, 255, 0.08)'
              : 'rgba(0, 0, 0, 0.06)',
            color: colors.primary,
          }}>
          {` ${part.slice(1, -1)} `}
        </Text>
      );
    }

    // 4. Italic text: *italic* or _italic_
    if (
      (part.startsWith('*') && part.endsWith('*')) ||
      (part.startsWith('_') && part.endsWith('_'))
    ) {
      return (
        <Text
          key={index}
          style={{
            fontFamily: Fonts.body,
            fontStyle: 'italic',
            color: colors.textSecondary,
          }}>
          {part.slice(1, -1)}
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
  h4: {
    fontFamily: Fonts.headingDemiBold,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
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
  numberBullet: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    minWidth: 22,
    paddingTop: 1,
  },
  listItemText: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 14,
    lineHeight: 21,
  },
  blockquote: {
    borderLeftWidth: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginVertical: 4,
  },
  blockquoteText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 21,
  },
  hr: {
    height: 1,
    marginVertical: 10,
    width: '100%',
  },
  tableWrapper: {
    marginVertical: 8,
    borderRadius: 10,
    overflow: 'hidden',
  },
  tableScrollContent: {
    paddingVertical: 2,
  },
  table: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tableCell: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 110,
    maxWidth: 280,
    justifyContent: 'center',
  },
  tableHeaderCell: {
    minWidth: 110,
    paddingVertical: 10,
  },
  tableHeaderText: {
    fontFamily: Fonts.headingDemiBold,
    fontSize: 13,
    fontWeight: '700',
  },
  tableCellText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    lineHeight: 19,
  },
});
