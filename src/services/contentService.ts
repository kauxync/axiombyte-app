import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS } from './api';
import { CodeLabModalData } from '@/data/roadmaps/types';
import * as Crypto from 'expo-crypto';

// In-memory caches for instant retrieval across sessions
const topicMarkdownCache = new Map<string, string>();
const codeLabItemCache = new Map<string, CodeLabModalData>();

/**
 * Compute SHA-256 of a string for integrity verification.
 */
async function sha256(text: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
}

/**
 * 1. Fetch Markdown Content for a Topic dynamically from remote Web API or local cache
 */
export async function getTopicContent(linkPath: string): Promise<string> {
  const normalizedPath = linkPath.startsWith('/') ? linkPath : `/${linkPath}`;

  // 1. Check in-memory cache
  if (topicMarkdownCache.has(normalizedPath)) {
    return topicMarkdownCache.get(normalizedPath)!;
  }

  // 2. Check AsyncStorage persistent cache with integrity verification
  const storageKey = `@axiombyte_md_${normalizedPath}`;
  const hashKey = `@axiombyte_md_hash_${normalizedPath}`;
  try {
    const cached = await AsyncStorage.getItem(storageKey);
    const storedHash = await AsyncStorage.getItem(hashKey);
    if (cached) {
      if (storedHash) {
        const computedHash = await sha256(cached);
        if (computedHash === storedHash) {
          topicMarkdownCache.set(normalizedPath, cached);
          return cached;
        } else {
          if (__DEV__) console.warn(`[ContentService] Integrity mismatch for cached markdown: ${normalizedPath}`);
        }
      } else {
        // Legacy cache without hash - populate in memory and update hash
        topicMarkdownCache.set(normalizedPath, cached);
        sha256(cached).then((h) => AsyncStorage.setItem(hashKey, h)).catch(() => {});
        return cached;
      }
    }
  } catch {
    // Continue to network fetch
  }

  // 3. Fetch fresh markdown from remote Web API
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const url = `${API_ENDPOINTS.TOPIC_CONTENT}?path=${encodeURIComponent(normalizedPath)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.data && json.data.markdown) {
        const md = json.data.markdown;
        const hash = await sha256(md);
        topicMarkdownCache.set(normalizedPath, md);
        await Promise.all([
          AsyncStorage.setItem(storageKey, md),
          AsyncStorage.setItem(hashKey, hash),
        ]);
        return md;
      }
    }
  } catch (err: any) {
    if (__DEV__) console.warn(`[ContentService] Failed to fetch content for ${normalizedPath}:`, err?.message || err);
  }

  // 4. Clean offline placeholder if content is not yet cached locally
  const title = normalizedPath.split('/').pop()?.replace(/_/g, ' ') || 'Topic Content';
  const cleanTitle = title.charAt(0).toUpperCase() + title.slice(1);
  return `# ${cleanTitle}\n\nThis lesson content is not yet downloaded. Connect to the internet to load and cache this topic.`;
}

/**
 * 2. Fetch CodeLab Item Data dynamically from remote Web API or local cache
 */
export async function getCodeLabItem(
  language: string,
  codeId: string
): Promise<CodeLabModalData> {
  const cacheKey = `${language}:${codeId}`;

  // 1. Check in-memory cache
  if (codeLabItemCache.has(cacheKey)) {
    return codeLabItemCache.get(cacheKey)!;
  }

  // 2. Check AsyncStorage persistent cache
  const storageKey = `@axiombyte_lab_${cacheKey}`;
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.code) {
        codeLabItemCache.set(cacheKey, parsed);
        return parsed;
      }
    }
  } catch {
    // Continue to network fetch
  }

  // 3. Fetch from remote Web API
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const url = `${API_ENDPOINTS.CODELAB_ITEM}?lang=${encodeURIComponent(language)}&code_id=${encodeURIComponent(codeId)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.data) {
        const item: CodeLabModalData = {
          codeId: json.data.codeId || codeId,
          title: json.data.title || codeId.replace(/_/g, ' '),
          language: json.data.language || language,
          code: json.data.code || '',
          output: json.data.output || '',
          howItWorks: Array.isArray(json.data.howItWorks) ? json.data.howItWorks : [],
        };
        codeLabItemCache.set(cacheKey, item);
        await AsyncStorage.setItem(storageKey, JSON.stringify(item));
        return item;
      }
    }
  } catch (err: any) {
    console.warn(`[ContentService] Failed to fetch CodeLab item for ${cacheKey}:`, err?.message || err);
  }

  // 4. Clean offline placeholder
  const title = codeId.replace(/_/g, ' ');
  return {
    codeId,
    title: title.charAt(0).toUpperCase() + title.slice(1),
    language,
    code: `// Code snippet: ${codeId}\n// Connect to the internet to load this interactive CodeLab.`,
    output: 'Program output pending network sync.',
    howItWorks: [
      'Executes within an isolated target sandbox.',
      'Connect to the internet to fetch dynamic execution steps.',
    ],
  };
}

/**
 * 3. Clear in-memory and persistent Markdown / Codelab caches
 */
export function clearContentMemoryCache(): void {
  topicMarkdownCache.clear();
  codeLabItemCache.clear();
}

export async function clearAllContentCaches(): Promise<void> {
  clearContentMemoryCache();
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const contentKeys = allKeys.filter(
      (k) => k.startsWith('@axiombyte_md_') || k.startsWith('@axiombyte_lab_')
    );
    if (contentKeys.length > 0) {
      await AsyncStorage.multiRemove(contentKeys);
    }
  } catch (err) {
    console.warn('[ContentService] Failed to clear content caches:', err);
  }
}
