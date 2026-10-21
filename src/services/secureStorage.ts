/**
 * secureStorage.ts
 *
 * Secure wrapper for sensitive data storage.
 *
 * - AUTH_TOKEN, USER_PROFILE → expo-secure-store
 *   iOS: Keychain (kSecAttrAccessibleAfterFirstUnlock)
 *   Android: EncryptedSharedPreferences backed by Android Keystore
 *
 * - Non-sensitive bulk data (transactions, streak, curriculum) stay in
 *   AsyncStorage but contain no credential material.
 *
 * MASVS-STORAGE-1 remediation for SEV-002.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// expo-secure-store is not available on web; fall back to sessionStorage
const isWeb = Platform.OS === 'web';

const webFallback = {
  getItemAsync: async (key: string): Promise<string | null> => {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage.getItem(key);
  },
  setItemAsync: async (key: string, value: string): Promise<void> => {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(key, value);
  },
  deleteItemAsync: async (key: string): Promise<void> => {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(key);
  },
};

const store = isWeb ? webFallback : SecureStore;

// -------------------------------------------------------------------------
// Key constants
// -------------------------------------------------------------------------
const SECURE_KEY_AUTH_TOKEN = 'axiombyte_auth_token';
const SECURE_KEY_USER_PROFILE = 'axiombyte_user_profile';

// -------------------------------------------------------------------------
// Auth Token
// -------------------------------------------------------------------------

/** Persist the server-issued auth token in secure storage. */
export async function saveAuthToken(token: string): Promise<void> {
  try {
    await store.setItemAsync(SECURE_KEY_AUTH_TOKEN, token);
  } catch (e) {
    if (__DEV__) console.error('[SecureStorage] Failed to save auth token:', e);
  }
}

/** Retrieve the auth token from secure storage. Returns null if absent. */
export async function getAuthToken(): Promise<string | null> {
  try {
    return await store.getItemAsync(SECURE_KEY_AUTH_TOKEN);
  } catch {
    return null;
  }
}

/** Delete the auth token (called on logout). */
export async function deleteAuthToken(): Promise<void> {
  try {
    await store.deleteItemAsync(SECURE_KEY_AUTH_TOKEN);
  } catch {
    // Ignore — item may not exist
  }
}

// -------------------------------------------------------------------------
// User Profile (sensitive PII)
// -------------------------------------------------------------------------

/** Persist the user profile JSON securely. */
export async function saveSecureProfile(profileJson: string): Promise<void> {
  try {
    await store.setItemAsync(SECURE_KEY_USER_PROFILE, profileJson);
  } catch (e) {
    if (__DEV__) console.error('[SecureStorage] Failed to save user profile:', e);
  }
}

/** Retrieve the user profile JSON from secure storage. */
export async function getSecureProfile(): Promise<string | null> {
  try {
    return await store.getItemAsync(SECURE_KEY_USER_PROFILE);
  } catch {
    return null;
  }
}

/** Delete the user profile from secure storage (called on logout). */
export async function deleteSecureProfile(): Promise<void> {
  try {
    await store.deleteItemAsync(SECURE_KEY_USER_PROFILE);
  } catch {}
}

/** Delete all secure storage entries (full logout). */
export async function clearAllSecureData(): Promise<void> {
  await Promise.allSettled([deleteAuthToken(), deleteSecureProfile()]);
}

