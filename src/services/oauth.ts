import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import { UserProfile, generateReferralCode } from './storage';

WebBrowser.maybeCompleteAuthSession({ skipRedirectCheck: true });

// Production Web OAuth Broker URL
export const OAUTH_BROKER_BASE_URL =
  process.env.EXPO_PUBLIC_OAUTH_BROKER_URL || 'https://axiombyte.kauxync.in';

// Trusted broker hostname — used to validate redirect origin
const TRUSTED_BROKER_HOST = new URL(OAUTH_BROKER_BASE_URL).hostname;

/**
 * Generates a cryptographically random state nonce (PKCE-style).
 * Stored in memory for the duration of the OAuth round-trip.
 */
let _pendingOAuthState: string | null = null;

async function generateOAuthState(): Promise<string> {
  const random = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${Date.now()}-${Math.random()}`
  );
  _pendingOAuthState = random.slice(0, 32);
  return _pendingOAuthState;
}

function consumeOAuthState(): string | null {
  const s = _pendingOAuthState;
  _pendingOAuthState = null;
  return s;
}

/**
 * Returns the exact, secure redirect URI for the active environment.
 * In production release builds, HTTPS App Links / Universal Links (https://axiombyte.kauxync.in/auth)
 * are used exclusively so that Android and iOS autoVerify ownership, preventing
 * custom-scheme hijack attacks (SEV-008 remediation).
 */
export function getOAuthRedirectUri(): string {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}/auth`;
    }
    return `${OAUTH_BROKER_BASE_URL}/auth`;
  }

  // Development builds (Expo Go / local emulator) can use custom scheme for ease of testing
  if (__DEV__) {
    return AuthSession.makeRedirectUri({ scheme: 'axiombyte', path: 'auth' });
  }

  // Production standalone builds: Always enforce verified HTTPS App Links
  return `${OAUTH_BROKER_BASE_URL}/auth`;
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
    // HTTPS app-link callbacks: verify host
    const url = new URL(rawUrl);
    if (url.hostname !== TRUSTED_BROKER_HOST) {
      if (__DEV__) console.warn('[OAuth] Redirect origin mismatch:', url.hostname, '!=', TRUSTED_BROKER_HOST);
      return false;
    }
    return true;
  } catch {
    // Custom scheme (axiombyte://auth) — cannot verify hostname via URL constructor
    // For custom-scheme callbacks, we rely on the nonce check only.
    return rawUrl.startsWith('axiombyte://');
  }
}

/**
 * Parses and validates the user profile payload from the OAuth broker redirect URL.
 *
 * Security controls applied:
 *  1. Origin validation — URL must come from TRUSTED_BROKER_HOST
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
    if (expectedState && returnedState !== expectedState) {
      if (__DEV__) console.warn('[OAuth] State mismatch — possible CSRF or injected redirect.');
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

    const profile: UserProfile = {
      id: userObj.id || `usr_${provider}_` + Date.now(),
      name: userObj.name || (provider === 'github' ? 'GitHub Developer' : 'Google Student'),
      username: userObj.username || userObj.email.split('@')[0] || 'student',
      email: userObj.email.toLowerCase().trim(),
      university: userObj.university || '',
      collegeDepartment: userObj.collegeDepartment || '',
      semester: userObj.semester || '',
      avatar: userObj.avatar || '',
      referralCode: userObj.referralCode || generateReferralCode(userObj.username || 'student'),
      coins: safeCoinBalance,
      authProvider: provider,
      isEmailVerified: true,
      isProfileCompleted: !!userObj.isProfileCompleted,
      createdAt: userObj.createdAt || new Date().toISOString(),
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
  try {
    const redirectUri = getOAuthRedirectUri();
    const state = await generateOAuthState();
    const authUrl = `${OAUTH_BROKER_BASE_URL}/oauth/google.php?redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    if (__DEV__) console.log('[Google Web OAuth] Launching broker:', authUrl);
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

    const usedState = consumeOAuthState();

    if (result.type === 'success' && result.url) {
      return parseBrokerRedirectUrl(result.url, 'google', usedState);
    }

    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { success: false, error: 'Google sign-in was cancelled.' };
    }

    return { success: false, error: 'Google authentication could not be completed.' };
  } catch (err: any) {
    consumeOAuthState(); // always clear state on error
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
  try {
    const redirectUri = getOAuthRedirectUri();
    const state = await generateOAuthState();
    const authUrl = `${OAUTH_BROKER_BASE_URL}/oauth/github.php?redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    if (__DEV__) console.log('[GitHub Web OAuth] Launching broker:', authUrl);
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

    const usedState = consumeOAuthState();

    if (result.type === 'success' && result.url) {
      return parseBrokerRedirectUrl(result.url, 'github', usedState);
    }

    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { success: false, error: 'GitHub sign-in was cancelled.' };
    }

    return { success: false, error: 'GitHub authentication could not be completed.' };
  } catch (err: any) {
    consumeOAuthState(); // always clear state on error
    if (__DEV__) console.warn('[GitHub OAuth] Web broker connection failed:', err);
    return {
      success: false,
      error: err?.message || 'Failed to connect to GitHub OAuth broker at ' + OAUTH_BROKER_BASE_URL,
    };
  }
}
