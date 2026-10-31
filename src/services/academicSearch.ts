/**
 * Academic Search & Caching Service
 * Provides instantaneous, multi-tiered caching for Universities and Departments:
 * 1. Immediate in-memory substring/prefix filtering (0ms latency, zero DB hits).
 * 2. Persistent offline AsyncStorage cache.
 * 3. Debounced remote synchronization to Hostinger MySQL with auto-creation.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { searchAcademicDirectory, ensureAcademicEntry } from './api';

const STORAGE_KEY_UNIVERSITIES = '@axiombyte_universities_cache_v1';
const STORAGE_KEY_DEPARTMENTS = '@axiombyte_departments_cache_v1';

// Initial pre-seed catalogs
const DEFAULT_UNIVERSITIES: string[] = [
  'Delhi Technological University (DTU)',
  'IIT Delhi (Indian Institute of Technology)',
  'IIT Bombay (Indian Institute of Technology)',
  'IIT Madras (Indian Institute of Technology)',
  'IIT Kanpur (Indian Institute of Technology)',
  'IIT Kharagpur (Indian Institute of Technology)',
  'IIT Roorkee (Indian Institute of Technology)',
  'IIT Guwahati (Indian Institute of Technology)',
  'IIT Hyderabad',
  'IIT (BHU) Varanasi',
  'NIT Trichy (National Institute of Technology)',
  'NIT Surathkal (National Institute of Technology)',
  'NIT Rourkela',
  'NIT Warangal',
  'BITS Pilani',
  'IIIT Hyderabad',
  'Netaji Subhas University of Technology (NSUT)',
  'Indraprastha Institute of Information Technology (IIIT Delhi)',
  'Anna University',
  'Jadavpur University',
  'Vellore Institute of Technology (VIT)',
  'Manipal Institute of Technology',
  'Thapar Institute of Engineering and Technology',
  'Massachusetts Institute of Technology (MIT)',
  'Stanford University',
  'Carnegie Mellon University',
  'University of California, Berkeley',
  'University of Cambridge',
  'University of Oxford',
  'National University of Singapore (NUS)',
];

const DEFAULT_DEPARTMENTS: string[] = [
  'Computer Science & Engineering (CSE)',
  'Mathematics & Computing',
  'Information Technology (IT)',
  'Software Engineering',
  'Artificial Intelligence & Machine Learning',
  'Data Science & Engineering',
  'Electronics & Communication Engineering (ECE)',
  'Electrical & Electronics Engineering (EEE)',
  'Computational Mathematics & Statistics',
  'Cyber Security & Digital Forensics',
  'Robotics & Automation',
  'Mechanical Engineering',
  'Civil Engineering',
  'Chemical Engineering',
  'Biotechnology & Bioinformatics',
];

// In-memory sets of known items for instant local lookup
const knownCatalog: {
  university: Set<string>;
  department: Set<string>;
} = {
  university: new Set(DEFAULT_UNIVERSITIES),
  department: new Set(DEFAULT_DEPARTMENTS),
};

// In-memory query result cache: key = `${type}:${cleanQuery}`
const queryCache = new Map<string, string[]>();

// Active debounce timers
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let currentSearchRequestId = 0;

/**
 * Initialize persistent cache from AsyncStorage
 */
let isInitialized = false;
export async function initAcademicCache(): Promise<void> {
  if (isInitialized) return;
  try {
    const [storedUnis, storedDepts] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEY_UNIVERSITIES),
      AsyncStorage.getItem(STORAGE_KEY_DEPARTMENTS),
    ]);

    if (storedUnis) {
      try {
        const parsed = JSON.parse(storedUnis);
        if (Array.isArray(parsed)) {
          parsed.forEach((u) => {
            const name = typeof u === 'string' ? u : (typeof u === 'object' && u !== null && 'name' in u ? String((u as any).name) : null);
            if (name && typeof name === 'string' && name.trim()) {
              knownCatalog.university.add(name.trim());
            }
          });
        }
      } catch {}
    }
    if (storedDepts) {
      try {
        const parsed = JSON.parse(storedDepts);
        if (Array.isArray(parsed)) {
          parsed.forEach((d) => {
            const name = typeof d === 'string' ? d : (typeof d === 'object' && d !== null && 'name' in d ? String((d as any).name) : null);
            if (name && typeof name === 'string' && name.trim()) {
              knownCatalog.department.add(name.trim());
            }
          });
        }
      } catch {}
    }
    isInitialized = true;
  } catch (err) {
    console.warn('[AcademicSearch] Error loading stored cache:', err);
  }
}

/**
 * Save known items to AsyncStorage in background
 */
async function persistCatalog(type: 'university' | 'department'): Promise<void> {
  try {
    const key = type === 'university' ? STORAGE_KEY_UNIVERSITIES : STORAGE_KEY_DEPARTMENTS;
    const items = Array.from(knownCatalog[type]).filter((x) => typeof x === 'string' && x.trim());
    await AsyncStorage.setItem(key, JSON.stringify(items));
  } catch (err) {
    console.warn('[AcademicSearch] Error saving cache to storage:', err);
  }
}

/**
 * Filter known local items synchronously (0ms latency, 0 DB calls)
 */
export function filterLocalCatalog(type: 'university' | 'department', query?: string | null): string[] {
  const safe = typeof query === 'string' ? query : '';
  const clean = safe.trim().toLowerCase();
  const allItems = Array.from(knownCatalog[type] || []);

  if (!clean) {
    return allItems
      .filter((item) => typeof item === 'string' && item.trim())
      .slice(0, 12);
  }

  // Rank: items starting with query first, then items containing query
  const startsWith: string[] = [];
  const contains: string[] = [];

  for (const rawItem of allItems) {
    if (!rawItem) continue;
    const item = typeof rawItem === 'string' ? rawItem : (typeof rawItem === 'object' && rawItem !== null && 'name' in rawItem ? String((rawItem as any).name) : String(rawItem));
    if (!item) continue;
    const lower = item.toLowerCase();
    if (lower.startsWith(clean)) {
      startsWith.push(item);
    } else if (lower.includes(clean)) {
      contains.push(item);
    }
  }

  return [...startsWith, ...contains].slice(0, 15);
}

/**
 * Search academic directory with multi-tier caching:
 * 1. Instantly returns local matches.
 * 2. Checks in-memory query cache.
 * 3. Debounces remote fetch to Hostinger DB to prevent API load.
 */
export function searchAcademicWithCache(
  type: 'university' | 'department',
  query?: string | null,
  onResultsUpdated?: (results: string[], isFromRemote: boolean) => void,
  onRemoteStart?: () => void
): () => void {
  const safe = typeof query === 'string' ? query : '';
  const clean = safe.trim().toLowerCase();
  const cacheKey = `${type}:${clean}`;

  // 1. Immediately provide local/cached results (0ms)
  if (queryCache.has(cacheKey)) {
    const cached = queryCache.get(cacheKey)!;
    onResultsUpdated?.(cached, false);
  } else {
    const localMatches = filterLocalCatalog(type, safe);
    onResultsUpdated?.(localMatches, false);
  }

  // 2. Clear any pending debounce request
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  const requestId = ++currentSearchRequestId;

  // 3. Debounce network lookup (280ms)
  debounceTimer = setTimeout(async () => {
    try {
      onRemoteStart?.();
      const res = await searchAcademicDirectory(type, clean, 20);

      // Verify this is still the active request
      if (requestId !== currentSearchRequestId) return;

      if (res.success && Array.isArray(res.data)) {
        const remoteItems = res.data;

        // Merge remote items into local catalog
        let hasNew = false;
        remoteItems.forEach((item) => {
          const itemName = typeof item === 'object' && item !== null && 'name' in item ? String((item as any).name) : (typeof item === 'string' ? item : '');
          if (itemName && itemName.trim() && !knownCatalog[type].has(itemName.trim())) {
            knownCatalog[type].add(itemName.trim());
            hasNew = true;
          }
        });

        // Combine local and remote results
        const combined = filterLocalCatalog(type, safe);
        queryCache.set(cacheKey, combined);

        if (hasNew) {
          persistCatalog(type);
        }

        onResultsUpdated?.(combined, true);
      } else {
        onResultsUpdated?.(filterLocalCatalog(type, safe), true);
      }
    } catch {
      // Remote fetch failed gracefully — local results remain active
      onResultsUpdated?.(filterLocalCatalog(type, safe), true);
    }
  }, 280);

  // Return cancel function
  return () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
  };
}

/**
 * Auto-create or ensure an academic entry in DB and local cache
 */
export async function autoCreateAcademic(
  type: 'university' | 'department',
  name: string
): Promise<void> {
  const clean = name.trim();
  if (!clean) return;

  // Add to local catalog immediately
  knownCatalog[type].add(clean);
  persistCatalog(type);

  // Invalidate in-memory query cache for this type
  for (const key of queryCache.keys()) {
    if (key.startsWith(`${type}:`)) {
      queryCache.delete(key);
    }
  }

  // Sync to Hostinger MySQL in background
  try {
    await ensureAcademicEntry(type, clean);
  } catch (err) {
    console.warn('[AcademicSearch] Background entry sync skipped:', err);
  }
}
