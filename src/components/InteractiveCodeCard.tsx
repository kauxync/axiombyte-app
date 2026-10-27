import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { WebView } from 'react-native-webview';
import { Fonts } from '@/constants/theme';
import { useAlert } from '@/context/AlertContext';
import {
  executeCodeWithPiston,
  isLanguageRunnable,
  isWebLanguage,
} from '@/services/codeRunner';

interface InteractiveCodeCardProps {
  initialCode: string;
  language?: string;
  noRun?: boolean;
  colors: any;
  isDark: boolean;
  accentColor?: string;
}

export function checkNoRun(langStr?: string): { isNoRun: boolean; cleanLang: string } {
  const trimmed = (langStr || '').trim();
  const isNoRun = /(?:[-_:,\s]|^)no-?run\b/i.test(trimmed);
  let cleanLang = trimmed.replace(/(?:[-_:,\s]|^)no-?run\b/gi, '').trim();

  // If cleanLang was literally "lang", empty, or generic, default to "code"
  if (!cleanLang || cleanLang.toLowerCase() === 'lang') {
    cleanLang = 'code';
  }

  return { isNoRun, cleanLang };
}

/**
 * Formats HTML, CSS, or JS code for the live sandboxed Web View preview.
 * Clean and un-opinionated — renders the exact code without arbitrary mock elements or styles.
 */
function formatHtmlForPreview(code: string, language: string): string {
  const lang = (language || 'html').toLowerCase();

  // 1. CSS Preview: wrap user CSS inside <style>
  if (lang === 'css') {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    ${code}
  </style>
</head>
<body>
</body>
</html>`;
  }

  // 2. JavaScript Preview: execute code cleanly and capture console.log & errors
  if (lang === 'javascript' || lang === 'js') {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    body {
      font-family: monospace;
      padding: 12px;
      margin: 0;
      background: #020617;
      color: #10B981;
      font-size: 13px;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .err { color: #F87171; }
  </style>
</head>
<body>
  <div id="output"></div>
  <script>
    const out = document.getElementById('output');
    function log(text, isErr) {
      const div = document.createElement('div');
      if (isErr) div.className = 'err';
      div.textContent = text;
      out.appendChild(div);
    }
    const _log = console.log;
    console.log = function(...args) {
      _log.apply(console, args);
      log(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '), false);
    };
    window.onerror = function(msg) {
      log('Error: ' + msg, true);
    };
    try {
      ${code}
    } catch(err) {
      log('Error: ' + err.message, true);
    }
  </script>
</body>
</html>`;
  }

  // 3. HTML Preview: if full document, render as-is; otherwise wrap with standard viewport meta tag
  const lower = code.toLowerCase();
  if (lower.includes('<html') || lower.includes('<!doctype')) {
    return code;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
</head>
<body>
${code}
</body>
</html>`;
}

function getLanguageMeta(lang: string) {
  const clean = lang.toLowerCase();
  switch (clean) {
    case 'html':
    case 'htm':
      return { label: 'HTML', icon: 'logo-html5', color: '#F97316' };
    case 'css':
      return { label: 'CSS', icon: 'logo-css3', color: '#38BDF8' };
    case 'javascript':
    case 'js':
      return { label: 'JAVASCRIPT', icon: 'logo-javascript', color: '#FBBF24' };
    case 'python':
    case 'py':
      return { label: 'PYTHON', icon: 'logo-python', color: '#34D399' };
    case 'c':
      return { label: 'C', icon: 'code-slash', color: '#38BDF8' };
    case 'cpp':
    case 'c++':
      return { label: 'C++', icon: 'code-slash', color: '#818CF8' };
    case 'rust':
    case 'rs':
      return { label: 'RUST', icon: 'shield-checkmark', color: '#F87171' };
    case 'code':
    case 'lang':
    case 'text':
    case 'txt':
    case 'plain':
      return { label: 'CODE', icon: 'code-slash', color: '#94A3B8' };
    default:
      return { label: clean.toUpperCase(), icon: 'code-slash', color: '#94A3B8' };
  }
}

export function InteractiveCodeCard({
  initialCode,
  language = 'c',
  noRun = false,
  colors,
  isDark,
  accentColor = '#38BDF8',
}: InteractiveCodeCardProps) {
  const { isNoRun: langIsNoRun, cleanLang } = checkNoRun(language);
  const isNoRun = Boolean(noRun) || langIsNoRun;
  const cleanLanguage = cleanLang || 'code';

  const { showAlert } = useAlert();
  const [code, setCode] = useState(initialCode);
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  // CLI/Piston Execution states (C, C++, Python, Rust, etc.)
  const [isRunning, setIsRunning] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  // Web Preview state (HTML, CSS, JS)
  const isWeb = isWebLanguage(cleanLanguage);
  const [showWebPreview, setShowWebPreview] = useState(false);
  const [webReloadKey, setWebReloadKey] = useState(0);

  const isRunnable = !isNoRun && isLanguageRunnable(cleanLanguage);
  const isModified = code !== initialCode;
  const meta = getLanguageMeta(cleanLanguage);

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showAlert('Copied', 'Code snippet copied to clipboard.');
    } catch {
      showAlert('Notice', 'Unable to copy snippet.');
    }
  };

  const handleReset = () => {
    setCode(initialCode);
    setTerminalOutput(null);
    setShowWebPreview(false);
    setIsError(false);
    setIsEditing(false);
  };

  const handleRun = async () => {
    if (isWeb) {
      // Toggle / reload Web Preview
      setWebReloadKey((prev) => prev + 1);
      setShowWebPreview(true);
      return;
    }

    if (isRunning) return;

    setIsRunning(true);
    setIsError(false);
    setTerminalOutput('⚡ Compiling & executing code...');

    const result = await executeCodeWithPiston(cleanLanguage, code);
    setTerminalOutput(result.output);
    setIsError(result.isError);
    setIsRunning(false);
  };

  return (
    <View style={styles.wrapper}>
      {/* Code Card Container */}
      <View
        style={[
          styles.codeCard,
          {
            backgroundColor: isDark ? '#090D16' : '#1E293B',
            borderColor: isEditing ? accentColor : colors.border,
          },
        ]}>
        {/* Header Bar */}
        <View style={styles.codeHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.codeLangBadge}>
              <Ionicons
                name={meta.icon as any}
                size={13}
                color={meta.color}
              />
              <Text style={styles.codeLangText}>{meta.label}</Text>
            </View>

            {isModified && (
              <View style={styles.editedBadge}>
                <Text style={styles.editedBadgeText}>Edited</Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.headerActions}>
            {!isNoRun && isModified && (
              <Pressable onPress={handleReset} hitSlop={6} style={styles.actionBtn}>
                <Ionicons name="refresh-outline" size={13} color="#94A3B8" />
                <Text style={styles.actionBtnText}>Reset</Text>
              </Pressable>
            )}

            {!isNoRun && (
              <Pressable
                onPress={() => setIsEditing(!isEditing)}
                hitSlop={6}
                style={[
                  styles.actionBtn,
                  isEditing && { backgroundColor: 'rgba(56, 189, 248, 0.2)' },
                ]}>
                <Ionicons
                  name={isEditing ? 'checkmark' : 'create-outline'}
                  size={13}
                  color={isEditing ? '#38BDF8' : '#94A3B8'}
                />
                <Text
                  style={[
                    styles.actionBtnText,
                    isEditing && { color: '#38BDF8', fontWeight: '700' },
                  ]}>
                  {isEditing ? 'Done' : 'Edit'}
                </Text>
              </Pressable>
            )}

            <Pressable onPress={handleCopy} hitSlop={6} style={styles.actionBtn}>
              <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={13}
                color={copied ? '#10B981' : '#94A3B8'}
              />
              <Text
                style={[
                  styles.actionBtnText,
                  copied && { color: '#10B981', fontWeight: '700' },
                ]}>
                {copied ? 'Copied' : 'Copy'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Code Content (View or Multiline Edit) */}
        {isEditing ? (
          <TextInput
            style={styles.codeTextInput}
            value={code}
            onChangeText={setCode}
            multiline={true}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            textAlignVertical="top"
          />
        ) : (
          <Text style={styles.codeText} selectable={true}>
            {code}
          </Text>
        )}

        {/* Bottom Run Action Toolbar */}
        {isRunnable && (
          <View style={styles.codeFooter}>
            <Text style={styles.runHintText} numberOfLines={1}>
              {isWeb
                ? isEditing
                  ? 'Edit code & reload live preview'
                  : 'Tap Run to render live preview'
                : isEditing
                ? 'Edit code above and test output'
                : 'Tap Edit to modify or Run to execute'}
            </Text>

            <Pressable
              onPress={handleRun}
              disabled={isRunning}
              style={({ pressed }) => [
                styles.runBtn,
                { backgroundColor: meta.color, shadowColor: meta.color },
                isRunning && { opacity: 0.7 },
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}>
              {isRunning ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="play" size={13} color="#FFFFFF" />
              )}
              <Text style={styles.runBtnText}>
                {isRunning
                  ? 'Running...'
                  : isWeb
                  ? showWebPreview
                    ? 'Reload Preview'
                    : 'Run Preview'
                  : 'Run Code'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* 1. Terminal Output Console (for C, C++, Python, Rust, etc.) */}
      {!isWeb && terminalOutput !== null && (
        <View
          style={[
            styles.terminalBox,
            { backgroundColor: isDark ? '#020617' : '#0F172A' },
          ]}>
          <View style={styles.terminalHeader}>
            <View style={styles.trafficLights}>
              <View style={[styles.light, { backgroundColor: '#EF4444' }]} />
              <View style={[styles.light, { backgroundColor: '#F59E0B' }]} />
              <View style={[styles.light, { backgroundColor: '#10B981' }]} />
              <Text style={styles.terminalTitle}>TERMINAL STDOUT</Text>
            </View>

            <Pressable
              onPress={() => setTerminalOutput(null)}
              hitSlop={8}
              style={styles.closeConsoleBtn}>
              <Ionicons name="close" size={14} color="#64748B" />
            </Pressable>
          </View>

          <Text
            style={[
              styles.terminalText,
              isError && { color: '#F87171' },
            ]}
            selectable={true}>
            {terminalOutput}
          </Text>
        </View>
      )}

      {/* 2. Live Web Preview Container (for HTML, CSS, JS) */}
      {isWeb && showWebPreview && (
        <View style={styles.webPreviewBox}>
          <View style={styles.webPreviewHeader}>
            <View style={styles.trafficLights}>
              <View style={[styles.light, { backgroundColor: '#EF4444' }]} />
              <View style={[styles.light, { backgroundColor: '#F59E0B' }]} />
              <View style={[styles.light, { backgroundColor: '#10B981' }]} />
              <Ionicons
                name={meta.icon as any}
                size={13}
                color={meta.color}
                style={{ marginLeft: 6 }}
              />
              <Text style={[styles.webPreviewTitle, { color: meta.color }]}>
                {meta.label} LIVE PREVIEW
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable
                onPress={() => setWebReloadKey((k) => k + 1)}
                hitSlop={6}
                style={styles.closeConsoleBtn}>
                <Ionicons name="reload" size={13} color="#64748B" />
              </Pressable>
              <Pressable
                onPress={() => setShowWebPreview(false)}
                hitSlop={8}
                style={styles.closeConsoleBtn}>
                <Ionicons name="close" size={14} color="#64748B" />
              </Pressable>
            </View>
          </View>

          {/* Rendered HTML / CSS / JS Web View */}
          <View style={styles.webViewContainer}>
            {Platform.OS === 'web' ? (
              // @ts-ignore Web iframe fallback with secure sandbox isolation
              <iframe
                key={webReloadKey}
                srcDoc={formatHtmlForPreview(code, cleanLanguage)}
                sandbox="allow-scripts"
                style={{
                  width: '100%',
                  height: 220,
                  border: 'none',
                  backgroundColor: '#FFFFFF',
                  borderRadius: 8,
                }}
                title="Web Preview"
              />
            ) : (
              <WebView
                key={webReloadKey}
                originWhitelist={['about:blank', 'data:*']}
                source={{ html: formatHtmlForPreview(code, cleanLanguage) }}
                style={styles.nativeWebView}
                javaScriptEnabled={true}
                domStorageEnabled={false}
                allowFileAccess={false}
                allowFileAccessFromFileURLs={false}
                allowUniversalAccessFromFileURLs={false}
                geolocationEnabled={false}
                scrollEnabled={true}
                onShouldStartLoadWithRequest={(request) => {
                  return request.url.startsWith('about:') || request.url.startsWith('data:');
                }}
              />
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 10,
  },
  codeCard: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
  },
  codeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  editedBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  editedBadgeText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 10,
    color: '#38BDF8',
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionBtnText: {
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
  codeTextInput: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    lineHeight: 20,
    color: '#E2E8F0',
    padding: 14,
    minHeight: 120,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  codeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  runHintText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: '#64748B',
    flex: 1,
    paddingRight: 8,
  },
  runBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  runBtnText: {
    fontFamily: Fonts.headingDemiBold,
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  terminalBox: {
    marginTop: 8,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  terminalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  trafficLights: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  light: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  terminalTitle: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: '#64748B',
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  closeConsoleBtn: {
    padding: 2,
  },
  terminalText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: '#10B981',
    lineHeight: 18,
  },
  webPreviewBox: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: '#0F172A',
  },
  webPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  webPreviewTitle: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  webViewContainer: {
    height: 220,
    backgroundColor: '#FFFFFF',
  },
  nativeWebView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
