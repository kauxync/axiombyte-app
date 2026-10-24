import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS } from './api';
import * as Crypto from 'expo-crypto';

// In-memory cache for instant retrieval across sessions
const topicMarkdownCache = new Map<string, string>();

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

  // In production, check in-memory cache first for instant retrieval
  if (!__DEV__ && topicMarkdownCache.has(normalizedPath)) {
    return topicMarkdownCache.get(normalizedPath)!;
  }

  // 2. Check AsyncStorage persistent cache with integrity verification
  const storageKey = `@axiombyte_md_${normalizedPath}`;
  const hashKey = `@axiombyte_md_hash_${normalizedPath}`;
  let cachedContent: string | null = null;

  try {
    const cached = await AsyncStorage.getItem(storageKey);
    const storedHash = await AsyncStorage.getItem(hashKey);
    if (cached) {
      if (storedHash) {
        const computedHash = await sha256(cached);
        if (computedHash === storedHash) {
          cachedContent = cached;
          if (!__DEV__) {
            topicMarkdownCache.set(normalizedPath, cached);
            return cached;
          }
        }
      } else {
        cachedContent = cached;
        if (!__DEV__) {
          topicMarkdownCache.set(normalizedPath, cached);
          sha256(cached).then((h) => AsyncStorage.setItem(hashKey, h)).catch(() => {});
          return cached;
        }
      }
    }
  } catch {
    // Continue to network fetch
  }

  // 3. Fetch fresh markdown from remote Web API
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), __DEV__ ? 5000 : 20000);

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
    if (__DEV__) console.warn(`[ContentService] Network fetch failed for ${normalizedPath}, falling back to cache:`, err?.message || err);
  }

  // 4. If network failed in dev but we had cached content, return it
  if (cachedContent) {
    topicMarkdownCache.set(normalizedPath, cachedContent);
    return cachedContent;
  }

  // 4. Clean offline placeholder if content is not yet cached locally
  const title = normalizedPath.split('/').pop()?.replace(/_/g, ' ') || 'Topic Content';
  const cleanTitle = title.charAt(0).toUpperCase() + title.slice(1);
  return `# ${cleanTitle}\n\nThis lesson content is not yet downloaded. Connect to the internet to load and cache this topic.`;
}

/**
 * 2. Clear in-memory and persistent Markdown caches
 */
export function clearContentMemoryCache(): void {
  topicMarkdownCache.clear();
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
