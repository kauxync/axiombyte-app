import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS } from './api';
import { LanguageRoadmap } from '@/data/roadmaps';
import { SubjectCurriculum } from '@/data/subjects';
import {
  ActiveStudyItem,
  RecentStudyRecord,
  buildDynamicActiveCourses,
} from './progressService';

export * from '@/data/roadmaps/types';
export * from '@/data/subjects/types';
export type { ActiveStudyItem, RecentStudyRecord };

export interface LabExample {
  id: string;
  title: string;
  language: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  description: string;
}

export interface CurriculumPayload {
  version: string;
  languages: LanguageRoadmap[];
  subjects: SubjectCurriculum[];
  activeCourses: ActiveStudyItem[];
  labExamples: LabExample[];
  lastUpdated?: string;
}

const STORAGE_KEY_CURRICULUM = '@axiombyte_curriculum_cache_v1';
const STORAGE_KEY_LAST_SYNCED = '@axiombyte_curriculum_last_synced';

// Initial empty payload structure (purely dynamic, no hardcoded curriculum)
export const DEFAULT_CURRICULUM_SEED: CurriculumPayload = {
  version: '1.0.0',
  languages: [],
  subjects: [],
  activeCourses: [],
  labExamples: [],
};

// In-memory active singleton
let activeCurriculumInMemory: CurriculumPayload = DEFAULT_CURRICULUM_SEED;

/**
 * 1. Read persistent local cached curriculum from AsyncStorage
 */
export async function loadCachedCurriculum(): Promise<CurriculumPayload> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_CURRICULUM);
    if (raw) {
      const parsed = JSON.parse(raw) as CurriculumPayload;
      if (
        parsed &&
        Array.isArray(parsed.languages) &&
        Array.isArray(parsed.subjects)
      ) {
        activeCurriculumInMemory = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[Curriculum] Could not read local storage cache:', err);
  }
  return DEFAULT_CURRICULUM_SEED;
}

/**
 * Internal helper to fetch latest curriculum from remote Web API
 */
async function fetchCurriculumFromNetwork(forceFresh?: boolean): Promise<CurriculumPayload | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000); // 25s timeout for mobile handshake

  try {
    // Cache-busting timestamp param guarantees fresh fetch without triggering CORS preflights
    const fetchUrl = `${API_ENDPOINTS.CURRICULUM}?_t=${Date.now()}${forceFresh ? '&force=1' : ''}`;

    const res = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.status === 304) {
      // 304 Not Modified: server confirmed cached payload is identical and fresh
      const cached = await loadCachedCurriculum();
      if (cached && cached.languages && cached.languages.length > 0) {
        return cached;
      }
    }

    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.data) {
        const remoteLangs = Array.isArray(json.data.languages) ? json.data.languages : [];
        const remoteSubjects = Array.isArray(json.data.subjects) ? json.data.subjects : [];

        const payload: CurriculumPayload = {
          version: json.data.version || '1.0.0',
          languages: remoteLangs,
          subjects: remoteSubjects,
          activeCourses:
            json.data.activeCourses ||
            buildDynamicActiveCourses(remoteLangs, remoteSubjects, []),
          labExamples: Array.isArray(json.data.labExamples) ? json.data.labExamples : [],
          lastUpdated: json.data.lastUpdated || new Date().toISOString(),
        };

        // Persist fresh Web API data into AsyncStorage cache
        await AsyncStorage.setItem(STORAGE_KEY_CURRICULUM, JSON.stringify(payload));
        await AsyncStorage.setItem(STORAGE_KEY_LAST_SYNCED, new Date().toISOString());

        activeCurriculumInMemory = payload;
        return payload;
      }
    } else {
      console.warn('[Curriculum] Server responded with HTTP status:', res.status);
    }
  } catch (err: any) {
    console.warn('[Curriculum] Network request failed:', err?.name || 'Error', err?.message || err);
  } finally {
    clearTimeout(timer);
  }
  return null;
}

/**
 * 2. Synchronize directly with remote Web API and update the AsyncStorage cache.
 * If server is offline or unreachable, delivers cached local content.
 */
export async function syncCurriculumWithServer(forceFresh?: boolean): Promise<{
  curriculum: CurriculumPayload;
  isOffline: boolean;
}> {
  // First attempt
  let payload = await fetchCurriculumFromNetwork(forceFresh);

  // Automatic retry if first attempt encountered network/TLS latency
  if (!payload) {
    payload = await fetchCurriculumFromNetwork(forceFresh);
  }

  if (payload) {
    return { curriculum: payload, isOffline: false };
  }

  // Fallback to local storage cache if network is truly unreachable
  const cached = await loadCachedCurriculum();
  return { curriculum: cached, isOffline: true };
}

/**
 * 3. Read the timestamp of the last successful curriculum cache synchronization
 */
export async function getLastSyncedTime(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEY_LAST_SYNCED);
  } catch {
    return null;
  }
}

/**
 * 4. Clear curriculum cache and reset to default seed data
 */
export async function clearCurriculumCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY_CURRICULUM);
    await AsyncStorage.removeItem(STORAGE_KEY_LAST_SYNCED);
    activeCurriculumInMemory = DEFAULT_CURRICULUM_SEED;
  } catch (err) {
    console.warn('[Curriculum] Could not clear cache:', err);
  }
}

/**
 * 5. Synchronous getter for current in-memory curriculum
 */
export function getCurriculumSnapshot(): CurriculumPayload {
  return activeCurriculumInMemory;
}

