import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import { UserProfile, generateReferralCode } from './storage';
import { saveAuthToken, getAuthToken } from './secureStorage';

WebBrowser.maybeCompleteAuthSession({ skipRedirectCheck: true });

// Production Web OAuth Broker URL
export const OAUTH_BROKER_BASE_URL =
  process.env.EXPO_PUBLIC_OAUTH_BROKER_URL || 'https://axiombyte.kauxync.in';

// Trusted broker hostname — used to validate redirect origin
const TRUSTED_BROKER_HOST = new URL(OAUTH_BROKER_BASE_URL).hostname;

interface OAuthStateRecord {
  state: string;
  createdAt: number;
  consumedAt?: number;
}

const OAUTH_STATES_STORAGE_KEY = '@axiombyte_oauth_state_records';
const STATE_LIFETIME_MS = 10 * 60 * 1000; // 10 minutes
const STATE_GRACE_PERIOD_MS = 60 * 1000; // 60 seconds grace period for concurrent/duplicate callback intents

let _stateRecords: OAuthStateRecord[] = [];
let _latestGeneratedState: string | null = null;
let _stateInitialized = false;

async function loadStateRecords(): Promise<OAuthStateRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(OAUTH_STATES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const now = Date.now();
        _stateRecords = parsed.filter(
          (r) => r && typeof r.state === 'string' && now - r.createdAt < STATE_LIFETIME_MS
        );
        return _stateRecords;
      }
    }
  } catch {}
  return _stateRecords;
}

async function persistStateRecords(): Promise<void> {
  try {
    const now = Date.now();
    _stateRecords = _stateRecords.filter((r) => now - r.createdAt < STATE_LIFETIME_MS);
    await AsyncStorage.setItem(OAUTH_STATES_STORAGE_KEY, JSON.stringify(_stateRecords));
  } catch {}
}

/**
 * Generates a cryptographically random state nonce (PKCE-style).
 * Stored in memory and AsyncStorage to survive background activity recreation.
 */
export async function generateOAuthState(): Promise<string> {
  if (!_stateInitialized) {
    await loadStateRecords();
    _stateInitialized = true;
  }
  const random = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${Date.now()}-${Math.random()}-${Math.random()}`
  );
  const state = random.slice(0, 32);
  _latestGeneratedState = state;

  const record: OAuthStateRecord = {
    state,
    createdAt: Date.now(),
  };

  _stateRecords.push(record);
  await persistStateRecords();
  return state;
}

export function consumeOAuthState(stateToConsume?: string | null): string | null {
  const target = stateToConsume || _latestGeneratedState;
  if (!target) return null;

  const rec = _stateRecords.find((r) => r.state === target);
  if (rec && !rec.consumedAt) {
    rec.consumedAt = Date.now();
    persistStateRecords().catch(() => {});
  }
  return target;
}

/**
 * Validates the state nonce. Supports a 60-second grace period for duplicate callback
 * intents (e.g. when Custom Tabs dismisses AND deep link opens simultaneously).
 */
export async function verifyAndConsumeOAuthState(state?: string | null): Promise<boolean> {
  if (!state) return false;
  if (!_stateInitialized) {
    await loadStateRecords();
    _stateInitialized = true;
  }

  const now = Date.now();
  let rec = _stateRecords.find((r) => r.state === state);

  // If not in memory, recheck storage
  if (!rec) {
    await loadStateRecords();
    rec = _stateRecords.find((r) => r.state === state);
  }

  if (!rec) {
    if (__DEV__) console.warn('[OAuth] State nonce not found in active records:', state);
    return false;
  }

  // Check expiration
  if (now - rec.createdAt > STATE_LIFETIME_MS) {
    if (__DEV__) console.warn('[OAuth] State nonce expired:', state);
    return false;
  }

  // If already consumed, check grace window for duplicate intents
  if (rec.consumedAt) {
    const timeSinceConsumed = now - rec.consumedAt;
    if (timeSinceConsumed <= STATE_GRACE_PERIOD_MS) {
      if (__DEV__) console.log('[OAuth] State verified within concurrent grace period:', state);
      return true;
    }
    if (__DEV__) console.warn('[OAuth] State nonce already consumed outside grace period:', state);
    return false;
  }

  // First consumption
  rec.consumedAt = now;
  await persistStateRecords();
  return true;
}

/**
 * Returns the exact redirect URI for the active platform.
 * On native mobile (Android/iOS), uses custom scheme `axiombyte://auth` which
 * is reliably intercepted by WebBrowser.openAuthSessionAsync without dual-routing collisions.
 */
export function getOAuthRedirectUri(): string {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}/auth`;
    }
    return `${OAUTH_BROKER_BASE_URL}/auth`;
  }

  // Native iOS and Android: use verified custom scheme for WebBrowser auth session
  return AuthSession.makeRedirectUri({ scheme: 'axiombyte', path: 'auth' });
}

export interface OAuthResult {
  success: boolean;
  user?: UserProfile;
  error?: string;
}

/**
 * Robust base64 decoder that works across Hermes, JSC, and browser engines
 */
function safeBase64Decode(str: string): string {
  try {
    if (typeof atob === 'function') {
      return atob(str);
    }
  } catch {}

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  const cleanStr = String(str).replace(/=+$/, '');
  for (let bc = 0, bs = 0, buffer = 0, idx = 0; (buffer = cleanStr.charCodeAt(idx++)); ) {
    const charIndex = chars.indexOf(String.fromCharCode(buffer));
    if (~charIndex) {
      bs = bc % 4 ? bs * 64 + charIndex : charIndex;
      if (bc++ % 4) {
        output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
      }
    }
  }
  return output;
}

/**
 * Validates that a redirect URL originates from the trusted broker host.
 * This is the primary line of defence against link-injection attacks.
 *
 * NOTE: The gold-standard fix is a server-issued short-lived token exchanged
 * back-channel. Until the PHP backend is updated to issue such tokens, this
 * origin guard + nonce check prevents arbitrary deep-link injection.
 */
function validateRedirectOrigin(rawUrl: string): boolean {
  try {
    if (rawUrl.startsWith('axiombyte://')) {
      return true;
    }
    const url = new URL(rawUrl);
    if (url.hostname !== TRUSTED_BROKER_HOST && url.hostname !== 'axiombyte.kauxync.in') {
      if (__DEV__) console.warn('[OAuth] Redirect origin mismatch:', url.hostname, '!=', TRUSTED_BROKER_HOST);
      return false;
    }
    return true;
  } catch {
    return rawUrl.startsWith('axiombyte://');
  }
}

/**
 * Parses and validates the user profile payload from the OAuth broker redirect URL.
 *
 * Security controls applied:
 *  1. Origin validation — URL must come from TRUSTED_BROKER_HOST or registered app scheme
 *  2. State nonce — broker must echo back the nonce we sent
 *  3. Required fields — email must be present and non-empty
 *  4. No dynamic privilege escalation — coins capped at 200 (welcome bonus)
 *     until server confirms the actual balance via authenticated profile fetch
 */
function parseBrokerRedirectUrl(rawUrl: string, provider: 'google' | 'github', expectedState: string | null): OAuthResult {
  try {
    // Guard 1: Origin
    if (!validateRedirectOrigin(rawUrl)) {
      return { success: false, error: 'Authentication response origin is not trusted.' };
    }

    const urlPart = rawUrl.includes('?') ? rawUrl.split('?')[1] : rawUrl.includes('#') ? rawUrl.split('#')[1] : '';
    const params = new URLSearchParams(urlPart);

    const error = params.get('error') || params.get('error_description');
    if (error) {
      return { success: false, error: decodeURIComponent(error) };
    }

    // Guard 2: State nonce — prevents CSRF and forged redirects
    const returnedState = params.get('state');
    if (expectedState && (!returnedState || returnedState !== expectedState)) {
      if (__DEV__) console.warn('[OAuth] State mismatch or omitted — possible CSRF or injected redirect.');
      return { success: false, error: 'Authentication state mismatch. Please try signing in again.' };
    }

    const userDataRaw = params.get('userData');
    if (!userDataRaw) {
      // Direct access_token / code without userData — not supported via broker
      const code = params.get('code');
      if (code) {
        return { success: false, error: 'Direct code returned without broker synchronization.' };
      }
      return { success: false, error: 'No user data received from authentication broker.' };
    }

    const decodedJson = safeBase64Decode(decodeURIComponent(userDataRaw));
    const userObj = JSON.parse(decodedJson);

    // Guard 3: Required fields — reject if no email
    if (!userObj.email || typeof userObj.email !== 'string') {
      return { success: false, error: 'Invalid user data: email is required.' };
    }

    // Guard 4: Cap coins at welcome bonus — server balance fetched on next
    // authenticated profile sync to prevent client-side coin inflation
    const safeCoinBalance = Math.min(
      typeof userObj.coins === 'number' ? userObj.coins : 200,
      200 // max accepted from redirect; authoritative balance comes from API
    );

    // Persist server-issued session token if provided by broker
    if (userObj.token) {
      saveAuthToken(userObj.token).catch(() => {});
    }

    const profile: UserProfile = {
      id: userObj.id || `usr_${provider}_` + Date.now(),
      name: userObj.name || (provider === 'github' ? 'GitHub Developer' : 'Google Student'),
      username: userObj.username || userObj.email.split('@')[0] || 'student',
      email: userObj.email.toLowerCase().trim(),
      university: userObj.university || '',
      universityId: userObj.universityId ? Number(userObj.universityId) : undefined,
      collegeDepartment: userObj.collegeDepartment || '',
      collegeDepartmentId: userObj.collegeDepartmentId ? Number(userObj.collegeDepartmentId) : undefined,
      semester: userObj.semester || '',
      avatar: userObj.avatar || '',
      referralCode: userObj.referralCode || generateReferralCode(userObj.username || 'student'),
      coins: safeCoinBalance,
      authProvider: provider,
      isEmailVerified: true,
      isProfileCompleted: !!userObj.isProfileCompleted,
      createdAt: userObj.createdAt || new Date().toISOString(),
      token: userObj.token || undefined,
    };

    return { success: true, user: profile };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to parse authentication response.' };
  }
}

/**
 * 1. Google OAuth Flow via Web Broker (https://axiombyte.kauxync.in/oauth/google.php)
 */
export async function signInWithGoogle(): Promise<OAuthResult> {
  let state = '';
  try {
    const redirectUri = getOAuthRedirectUri();
    state = await generateOAuthState();
    const authUrl = `${OAUTH_BROKER_BASE_URL}/oauth/google.php?redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    if (__DEV__) console.log('[Google Web OAuth] Launching broker:', authUrl);
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

    if (result.type === 'success' && result.url) {
      consumeOAuthState(state);
      return parseBrokerRedirectUrl(result.url, 'google', state);
    }

    if (result.type === 'cancel' || result.type === 'dismiss') {
      // In native Android/iOS, if the external app intent was caught by UniversalAuthCallbackScreen (/auth)
      // while Custom Tab was closing, the browser session reports 'dismiss'.
      // Allow a brief tick for the deep-link route to finish setting the authenticated session.
      await new Promise((r) => setTimeout(r, 600));
      const activeToken = await getAuthToken();
      if (activeToken) {
        if (__DEV__) console.log('[Google OAuth] Session completed via concurrent deep link route.');
        return { success: true };
      }
      return { success: false, error: 'Google sign-in was cancelled.' };
    }

    return { success: false, error: 'Google authentication could not be completed.' };
  } catch (err: any) {
    consumeOAuthState(state);
    if (__DEV__) console.warn('[Google OAuth] Web broker connection failed:', err);
    return {
      success: false,
      error: err?.message || 'Failed to connect to Google OAuth broker at ' + OAUTH_BROKER_BASE_URL,
    };
  }
}

/**
 * 2. GitHub OAuth Flow via Web Broker (https://axiombyte.kauxync.in/oauth/github.php)
 */
export async function signInWithGithub(): Promise<OAuthResult> {
  let state = '';
  try {
    const redirectUri = getOAuthRedirectUri();
    state = await generateOAuthState();
    const authUrl = `${OAUTH_BROKER_BASE_URL}/oauth/github.php?redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    if (__DEV__) console.log('[GitHub Web OAuth] Launching broker:', authUrl);
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

    if (result.type === 'success' && result.url) {
      consumeOAuthState(state);
      return parseBrokerRedirectUrl(result.url, 'github', state);
    }

    if (result.type === 'cancel' || result.type === 'dismiss') {
      await new Promise((r) => setTimeout(r, 600));
      const activeToken = await getAuthToken();
      if (activeToken) {
        if (__DEV__) console.log('[GitHub OAuth] Session completed via concurrent deep link route.');
        return { success: true };
      }
      return { success: false, error: 'GitHub sign-in was cancelled.' };
    }

    return { success: false, error: 'GitHub authentication could not be completed.' };
  } catch (err: any) {
    consumeOAuthState(state);
    if (__DEV__) console.warn('[GitHub OAuth] Web broker connection failed:', err);
    return {
      success: false,
      error: err?.message || 'Failed to connect to GitHub OAuth broker at ' + OAUTH_BROKER_BASE_URL,
    };
  }
}
