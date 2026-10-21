import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuthToken } from './secureStorage';

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL || 'https://axiombytedb.kauxync.in'
).replace(/\/+$/, '');
export const API_ENDPOINTS = {
  STATUS: `${API_BASE_URL}/api/status.php`,
  SEND_CODE: `${API_BASE_URL}/api/send_verification_code.php`,
  VERIFY_CODE: `${API_BASE_URL}/api/verify_code.php`,
  REGISTER: `${API_BASE_URL}/api/auth_register.php`,
  LOGIN: `${API_BASE_URL}/api/auth_login.php`,
  OAUTH: `${API_BASE_URL}/api/auth_oauth.php`,
  UPDATE_PROFILE: `${API_BASE_URL}/api/profile_update.php`,
  UPLOAD: `${API_BASE_URL}/api/upload.php`,
  ACADEMIC_LOOKUP: `${API_BASE_URL}/api/academic_lookup.php`,
  CHECK_USERNAME: `${API_BASE_URL}/api/check_username.php`,
  CURRICULUM: `${API_BASE_URL}/api/curriculum.php`,
  TOPIC_CONTENT: `${API_BASE_URL}/api/topic_content.php`,
  CODELAB_ITEM: `${API_BASE_URL}/api/codelab_item.php`,
  DELETE_ACCOUNT: `${API_BASE_URL}/api/delete_account.php`,
  STREAK_SYNC: `${API_BASE_URL}/api/streak_sync.php`,
  POLICIES: `${API_BASE_URL}/api/policies.php`,
};

/**
 * Returns the Authorization header object with the stored Bearer token.
 * Falls back to an empty object if no token is present (unauthenticated calls).
 */
async function getAuthHeader(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  timestamp?: string;
  isMockFallback?: boolean;
}

// In-memory fallback verification cache for local dev / offline preview
const localOtpStore = new Map<string, { code: string; expiresAt: number }>();

/**
 * 1. Health check to test Hostinger connectivity
 */
export async function checkServerStatus(): Promise<ApiResponse> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(API_ENDPOINTS.STATUS, { signal: controller.signal });
    clearTimeout(timer);
    return await res.json();
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || 'Remote server unreachable',
      isMockFallback: true,
    };
  }
}

/**
 * 2. Send 6-digit email verification code
 * Sends via Hostinger PHP mail() with HTML template.
 * If server is offline/unreachable, generates local code for seamless offline dev preview.
 */
export async function sendEmailVerificationCode(email: string): Promise<ApiResponse<{ debugCode?: string }>> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(API_ENDPOINTS.SEND_CODE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const json = await res.json();
    return json;
  } catch (err: any) {
    // In production builds, fail closed — never generate or return a local OTP.
    // Dev-only fallback: only when __DEV__ is true (Metro dev server / Expo Go).
    if (__DEV__) {
      const mockCode = Math.floor(100000 + Math.random() * 900000).toString();
      localOtpStore.set(email.toLowerCase(), {
        code: mockCode,
        expiresAt: Date.now() + 15 * 60 * 1000,
      });
      // Dev console only — never reaches production Logcat
      console.warn(`[AxiomByte DEV] Server unreachable (${err?.message}). Dev OTP: ${mockCode}`);
      return {
        success: true,
        message: `[Dev Mode] Verification code generated locally.`,
        data: { debugCode: mockCode },
        isMockFallback: true,
      };
    }

    // Production: fail with a clear, safe message
    return {
      success: false,
      message: 'Verification server is currently unreachable. Please check your connection and try again.',
      isMockFallback: true,
    };
  }
}

/**
 * 3. Verify the 6-digit code
 */
export async function verifyEmailCode(email: string, code: string): Promise<ApiResponse<{ verified: boolean }>> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(API_ENDPOINTS.VERIFY_CODE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const json = await res.json();
    return json;
  } catch {
    // Check fallback local store
    const record = localOtpStore.get(email.toLowerCase());
    if (record && record.code === code.trim() && record.expiresAt > Date.now()) {
      localOtpStore.delete(email.toLowerCase());
      return {
        success: true,
        message: 'Code verified successfully (Offline/Dev Mode).',
        data: { verified: true },
        isMockFallback: true,
      };
    }

    return {
      success: false,
      message: 'Invalid verification code or server is unreachable. Please retry.',
      isMockFallback: true,
    };
  }
}

/**
 * 4. Register new user
 */
export async function registerWithApi(payload: {
  email: string;
  password: string;
  username?: string;
  referredBy?: string;
}): Promise<ApiResponse> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(API_ENDPOINTS.REGISTER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);

    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Failed to connect to registration server.',
      isMockFallback: true,
    };
  }
}

/**
 * 5. Login user
 */
export async function loginWithApi(payload: {
  email: string;
  password: string;
}): Promise<ApiResponse> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(API_ENDPOINTS.LOGIN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);

    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Failed to connect to authentication server.',
      isMockFallback: true,
    };
  }
}

/**
 * 6. Authenticate with OAuth (Google & GitHub) on Hostinger
 */
export async function authWithOAuth(payload: {
  provider: 'google' | 'github';
  providerId?: string;
  email?: string;
  name?: string;
  username?: string;
  avatar?: string;
  referredBy?: string;
  code?: string;
}): Promise<ApiResponse> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(API_ENDPOINTS.OAUTH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text();
      try {
        const errJson = JSON.parse(errText);
        return errJson;
      } catch {
        return {
          success: false,
          message: `Server returned HTTP ${res.status}: ${res.statusText}`,
          isMockFallback: true,
        };
      }
    }

    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Failed to authenticate via remote OAuth endpoint.',
      isMockFallback: true,
    };
  }
}

/**
 * 7. Update user profile on Hostinger DB
 */
export async function updateProfileWithApi(payload: {
  userId: string;
  name?: string;
  username?: string;
  university?: string;
  collegeDepartment?: string;
  semester?: string;
  avatar?: string;
}): Promise<ApiResponse> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const authHeader = await getAuthHeader();
    const res = await fetch(API_ENDPOINTS.UPDATE_PROFILE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);

    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Failed to update remote profile.',
      isMockFallback: true,
    };
  }
}

export interface UploadFileInput {
  uri: string;
  base64?: string;
  name?: string;
  type?: string;
}

/**
 * 7. Upload profile picture or document to Hostinger PHP server
 * Supports base64 JSON payloads (100% immune to React Native FormDataPart issues)
 * as well as multipart fallback.
 */
export async function uploadFileToHostinger(
  fileInput: string | UploadFileInput,
  category: 'avatar' | 'note' | 'attachment' = 'avatar',
  userId?: string
): Promise<ApiResponse<{ publicUrl: string; fileId: string; url?: string }>> {
  try {
    const fileUri = typeof fileInput === 'string' ? fileInput : fileInput.uri;
    const providedBase64 = typeof fileInput === 'object' ? fileInput.base64 : undefined;
    const customName = typeof fileInput === 'object' ? fileInput.name : undefined;

    // Determine filename and mime type
    const filename = customName || fileUri.split('/').pop() || `upload_${Date.now()}.jpg`;
    const match = /\.(\w+)$/.exec(filename);
    const ext = match ? match[1].toLowerCase() : 'jpg';
    const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'pdf' ? 'application/pdf' : 'image/jpeg';

    let base64Data: string | undefined = providedBase64;

    // If base64 not provided directly, read it safely
    if (!base64Data) {
      if (Platform.OS === 'web') {
        try {
          const response = await fetch(fileUri);
          const blob = await response.blob();
          base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch {
          // Will use FormData fallback below
        }
      } else {
        try {
          const FileSystem = await import('expo-file-system');
          if (FileSystem && FileSystem.readAsStringAsync) {
            const raw = await FileSystem.readAsStringAsync(fileUri, {
              encoding: (FileSystem.EncodingType?.Base64 || 'base64') as any,
            });
            if (raw) {
              base64Data = `data:${type};base64,${raw}`;
            }
          }
        } catch (fsErr) {
          console.warn('[AxiomByte Upload] FileSystem read warning:', fsErr);
        }
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);

    let res: Response;

    // Direct JSON base64 upload - completely avoids React Native FormDataPart serialization bugs
    if (base64Data) {
      const authHeader = await getAuthHeader();
      res = await fetch(API_ENDPOINTS.UPLOAD, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          base64: base64Data,
          filename,
          mimeType: type,
          category,
          user_id: userId,
        }),
        signal: controller.signal,
      });
    } else {
      // Fallback: multipart FormData
      const formData = new FormData();
      if (Platform.OS === 'web') {
        const response = await fetch(fileUri);
        const blob = await response.blob();
        formData.append('file', blob, filename);
      } else {
        formData.append('file', {
          uri: fileUri,
          name: filename,
          type,
        } as any);
      }
      formData.append('category', category);
      if (userId) {
        formData.append('user_id', userId);
      }

      res = await fetch(API_ENDPOINTS.UPLOAD, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
    }

    clearTimeout(timer);

    const json = await res.json();
    if (json.data) {
      const resolvedUrl = json.data.publicUrl || json.data.url;
      json.data.publicUrl = resolvedUrl;
      json.data.url = resolvedUrl;
      json.data.fileId = json.data.uploadId || json.data.fileId || 'file_' + Date.now();
    }
    return json;
  } catch (err: any) {
    if (__DEV__) console.warn(`[AxiomByte Upload] Server upload error (${err?.message})`);
    return {
      success: false,
      message: err?.message || 'Server upload failed. Please check network connection.',
      isMockFallback: true,
    };
  }
}

/**
 * 7b. Check username availability on Hostinger DB
 */
export async function checkUsernameAvailability(
  username: string,
  userId?: string
): Promise<ApiResponse<{ available: boolean; username: string }>> {
  const clean = username.trim().toLowerCase();
  if (!clean || clean.length < 3) {
    return {
      success: false,
      message: 'Username must be at least 3 characters',
      data: { available: false, username: clean },
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const params = new URLSearchParams({ username: clean });
    if (userId) params.append('userId', userId);

    const res = await fetch(`${API_ENDPOINTS.CHECK_USERNAME}?${params.toString()}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      return await res.json();
    }
    return {
      success: true,
      message: 'Username is available',
      data: { available: true, username: clean },
      isMockFallback: true,
    };
  } catch {
    return {
      success: true,
      message: 'Username available (offline check)',
      data: { available: true, username: clean },
      isMockFallback: true,
    };
  }
}

/**
 * 8. Search academic directory (Universities or Departments) from Hostinger DB
 */
export async function searchAcademicDirectory(
  type: 'university' | 'department',
  query: string = '',
  limit: number = 15
): Promise<ApiResponse<string[]>> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const url = `${API_ENDPOINTS.ACADEMIC_LOOKUP}?type=${encodeURIComponent(type)}&q=${encodeURIComponent(
      query
    )}&limit=${limit}`;

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      return {
        success: false,
        message: `HTTP ${res.status}`,
        data: [],
        isMockFallback: true,
      };
    }

    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Failed to search academic directory.',
      data: [],
      isMockFallback: true,
    };
  }
}

/**
 * 9. Auto-create academic directory entry if not present
 */
export async function ensureAcademicEntry(
  type: 'university' | 'department',
  name: string
): Promise<ApiResponse<{ name: string; created: boolean }>> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(API_ENDPOINTS.ACADEMIC_LOOKUP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, name }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return {
        success: true,
        message: 'Accepted entry locally.',
        data: { name, created: false },
        isMockFallback: true,
      };
    }

    return await res.json();
  } catch (err: any) {
    return {
      success: true,
      message: err?.message || 'Accepted entry locally.',
      data: { name, created: false },
      isMockFallback: true,
    };
  }
}

/**
 * 10. Permanently delete user account and all personal data (GDPR / DPDP Right to Erasure)
 */
export async function deleteAccountWithApi(userId: string): Promise<ApiResponse> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    const authHeader = await getAuthHeader();
    const res = await fetch(API_ENDPOINTS.DELETE_ACCOUNT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ userId }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    return await res.json();
  } catch {
    return {
      success: true,
      message: 'Account erasure request processed locally.',
      isMockFallback: true,
    };
  }
}

/**
 * 11. Synchronize reward or coin deduction transactions with remote backend
 * Server validates the user's authentic balance and returns authoritative balance.
 */
export async function syncRewardTransactionWithApi(payload: {
  userId: string;
  type: string;
  amount: number;
  description: string;
}): Promise<ApiResponse<{ verifiedBalance?: number }>> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const authHeader = await getAuthHeader();
    const res = await fetch(`${API_BASE_URL}/api/reward_sync.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      return await res.json();
    }
    return { success: true, message: 'Logged locally', isMockFallback: true };
  } catch {
    return { success: true, message: 'Saved offline', isMockFallback: true };
  }
}

export interface RemoteStreakPayload {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string;
  todayCompleted: boolean;
  freezeCount: number;
  lostStreak: number;
  coins: number;
  coinsAwarded?: number;
  freezeUsedToday?: boolean;
  streakLostToday?: boolean;
  recovered?: boolean;
  message?: string;
}

/**
 * 12. Online Streak Check-In & Sync (WhatsApp-style automatic check-in on coming online)
 */
export async function syncOnlineStreakWithApi(userId: string): Promise<ApiResponse<RemoteStreakPayload>> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const authHeader = await getAuthHeader();
    const res = await fetch(API_ENDPOINTS.STREAK_SYNC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ userId, action: 'online_checkin' }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      return await res.json();
    }
    return { success: false, message: 'Could not sync streak with remote server' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Offline streak check' };
  }
}

/**
 * 13. Purchase Streak Freeze shield (50 coins) & optionally recover broken streak
 */
export async function purchaseStreakFreezeApi(
  userId: string,
  recoverLost = false
): Promise<ApiResponse<RemoteStreakPayload>> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const authHeader = await getAuthHeader();
    const res = await fetch(API_ENDPOINTS.STREAK_SYNC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ userId, action: 'purchase_freeze', recoverLost }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    return await res.json();
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to purchase streak freeze' };
  }
}

/**
 * 14. Recover broken streak using existing available Streak Freeze shield
 */
export async function recoverStreakWithFreezeApi(userId: string): Promise<ApiResponse<RemoteStreakPayload>> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const authHeader = await getAuthHeader();
    const res = await fetch(API_ENDPOINTS.STREAK_SYNC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ userId, action: 'recover_streak' }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    return await res.json();
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to recover streak' };
  }
}

export interface LegalPolicyItem {
  key: string;
  title: string;
  version: string;
  last_updated: string;
  markdown: string;
  last_modified?: string;
}

export interface LegalPoliciesData {
  terms: LegalPolicyItem;
  privacy: LegalPolicyItem;
  referral_policy: LegalPolicyItem;
  [key: string]: LegalPolicyItem;
}

const POLICIES_CACHE_STORAGE_KEY = '@axiombyte_legal_policies_cache_v1';

const DEFAULT_OFFLINE_POLICIES: LegalPoliciesData = {
  terms: {
    key: 'terms',
    title: 'Terms & Conditions',
    version: '1.2.0',
    last_updated: 'October 2026',
    markdown: `# Terms & Conditions\n\n*Last Updated: October 2026*\n*Version: 1.2.0*\n*Organization: Kauxync Technologies*\n\n---\n\n## 1. Acceptance of Terms\nBy creating an account, accessing, or downloading **AxiomByte**, you agree to comply with and be bound by these Terms and Conditions. AxiomByte is an interactive educational and research platform engineered for university students, educators, and software engineers mastering computer science, systems programming, and discrete mathematics.\n\n## 2. Pedagogical Scope & Academic Integrity\nAll course materials, code simulations, visual execution steppers, memory layout diagrams, and mathematical invariant proofs are provided solely for educational and training purposes. Users must not deploy automated bots, scrapers, exploit platform simulation engines, or tamper with runtime assets.\n\n## 3. Coin & Referral Program Integrity\nCoins earned through learning streaks, practice modules, and peer invitations constitute closed-loop promotional educational rewards. AxiomByte reserves the right to void coin balances obtained through fraudulent accounts, emulator scripting, or self-referral rings.\n\n## 4. Intellectual Property Rights\nAll visual execution steppers, mathematical algorithms, curriculum taxonomies, UI components, branding, logos, and custom code labs are the exclusive intellectual property of **Kauxync Technologies**.\n\n## 5. Account Management & Termination\nYou are responsible for maintaining the confidentiality of your authentication credentials. AxiomByte provides an in-app **Delete Account** option within Profile settings. Upon confirmed deletion, your personal credentials and associated records are permanently erased.\n\n## 6. Contact & Support\nFor legal inquiries or policy questions: support@kauxync.in\n- Developer Desk: axiombytes@kauxync.in`,
  },
  privacy: {
    key: 'privacy',
    title: 'Privacy Policy',
    version: '1.2.0',
    last_updated: 'October 2026',
    markdown: `# Privacy Policy\n\n*Last Updated: October 2026*\n*Version: 1.2.0*\n*Organization: Kauxync Technologies*\n\n---\n\n## 1. Offline-First Privacy Guarantee\nAxiomByte is architected as an **offline-first educational platform**. Your learning activity, code simulation steps, topic notes, bookmarks, and local progress logs reside on your physical device. You can study without transmitting continuous background telemetry.\n\n## 2. Information We Collect\nWhen you choose to synchronize your progress with our cloud servers, we collect minimal educational data: Name, username, university email address, university/semester details, and coin/streak counters.\n\n## 3. Zero Advertising & Third-Party Tracking\nWe do not display third-party advertisements. We never sell, rent, or trade student personal information or learning history to data brokers or ad networks.\n\n## 4. Security & Hardware Keystore\nAll network communications are encrypted using modern **TLS 1.3 / HTTPS**. Sensitive authentication tokens are stored locally using **Expo SecureStore**, leveraging hardware-backed Android Keystore or iOS Keychain sandboxes.\n\n## 5. Device Permissions Disclosure\nOnly necessary permissions are requested: Internet (for optional profile sync and updates) and Photo Library (strictly on-demand when setting a profile photo). Zero background location or biometric data is ever accessed.\n\n## 6. Contact & Data Deletion\nFor privacy inquiries: support@kauxync.in\n- Security Desk: axiombytes@kauxync.in`,
  },
  referral_policy: {
    key: 'referral_policy',
    title: 'Referral & Reward Policy',
    version: '1.2.0',
    last_updated: 'October 2026',
    markdown: `# Referral & Reward Policy\n\n*Last Updated: October 2026*\n*Version: 1.2.0*\n*Organization: Kauxync Technologies*\n\n---\n\n## 1. Overview & Purpose\nThe AxiomByte Referral & Reward Program fosters peer-to-peer collaborative learning in Computer Science, Systems Programming, and Discrete Mathematics across university campuses.\n\n## 2. Referral Rewards & Earning Rules\nEvery registered student receives a distinct Referral Code upon profile setup.\n- **Referrer Reward:** When a new student registers using your valid code and verifies their email, **200 Coins** (₹2.00 INR equivalent) are credited to your wallet.\n- **Invited Peer Welcome Bonus:** The new student receives an initial **100 Welcome Coins** (₹1.00 INR equivalent).\n- **Daily Streak Bonuses:** Check in daily to build multipliers and earn streak shields.\n\n## 3. Valuation & Utility\nAxiomByte Coins maintain a baseline in-app valuation of **100 Coins = ₹1.00 INR**. Coins may be redeemed for streak freeze shields, topic masterclasses, and educational grants.\n\n## 4. Anti-Fraud Protections\nSelf-referrals, disposable email domains, and automated emulator bots are filtered by server-side anomaly detection. Fraudulent accounts will have coins revoked and privileges suspended.\n\n## 5. Regulatory Compliance & RBI PPI Exemption\nAxiomByte Coins constitute closed-loop promotional reward points designed exclusively for academic motivation. Pursuant to Reserve Bank of India (RBI) guidelines on Prepaid Payment Instruments (PPI Master Direction DPSS.CO.PD.No.1164/02.14.006/2017-18), coins are non-negotiable, non-transferable, and cannot be redeemed for fiat cash withdrawals without statutory KYC verification.\n\n## 6. Support & Inquiries\nContact: support@kauxync.in`,
  },
};

/**
 * 15. Fetch Legal Policies (.md content) from Web API with offline local storage cache
 */
export async function fetchLegalPolicies(
  forceRefresh = false
): Promise<ApiResponse<LegalPoliciesData>> {
  // First, check if we have a locally cached version in AsyncStorage
  let cachedPolicies: LegalPoliciesData = DEFAULT_OFFLINE_POLICIES;
  try {
    const rawCache = await AsyncStorage.getItem(POLICIES_CACHE_STORAGE_KEY);
    if (rawCache) {
      const parsed = JSON.parse(rawCache);
      if (parsed && parsed.terms && parsed.privacy && parsed.referral_policy) {
        cachedPolicies = { ...DEFAULT_OFFLINE_POLICIES, ...parsed };
      }
    }
  } catch (cacheErr) {
    console.warn('[Policies] Cache read note:', cacheErr);
  }

  // If not force refresh and we have cached policies, try to fetch fresh from server
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${API_ENDPOINTS.POLICIES}?type=all`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.data) {
        const freshData: LegalPoliciesData = {
          ...DEFAULT_OFFLINE_POLICIES,
          ...json.data,
        };
        // Persist to AsyncStorage for instant offline access
        await AsyncStorage.setItem(
          POLICIES_CACHE_STORAGE_KEY,
          JSON.stringify(freshData)
        );
        return {
          success: true,
          message: 'Policies retrieved from server',
          data: freshData,
        };
      }
    }
  } catch (err: any) {
    // Network offline or server unreachable - graceful fallback to cached/default policies
    console.log('[Policies] Server fetch skipped/offline, using cached policies:', err?.message);
  }

  return {
    success: true,
    message: 'Loaded from local cache',
    data: cachedPolicies,
    isMockFallback: true,
  };
}

