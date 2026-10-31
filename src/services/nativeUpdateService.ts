import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import { API_ENDPOINTS } from './api';

export interface NativeReleaseInfo {
  isUpdateAvailable: boolean;
  isMandatory: boolean;
  currentVersion: string;
  currentVersionCode: number;
  latestVersion: string;
  latestVersionCode: number;
  apkDownloadUrl: string;
  releaseNotes: string;
  fileSizeBytes?: number;
  releasedAt?: string;
}

type NativeUpdateListener = (info: NativeReleaseInfo) => void;
const _listeners = new Set<NativeUpdateListener>();

export function onNativeUpdateAvailable(listener: NativeUpdateListener): () => void {
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}

export function notifyNativeUpdateAvailable(info: NativeReleaseInfo) {
  for (const listener of _listeners) {
    try {
      listener(info);
    } catch (e) {
      console.error('[NativeUpdate] Listener error:', e);
    }
  }
}

/**
 * Returns current installed app version information
 */
export function getCurrentVersionInfo(): { version: string; versionCode: number } {
  const version = Constants.expoConfig?.version || '1.0.0';
  const versionCode =
    typeof Constants.expoConfig?.android?.versionCode === 'number'
      ? Constants.expoConfig.android.versionCode
      : 1;

  return { version, versionCode };
}

/**
 * Queries the remote backend to check if a new standalone APK build has been released.
 */
export async function checkForNativeApkUpdate(): Promise<NativeReleaseInfo | null> {
  // Option B is specifically designed for standalone Android APK distribution
  if (Platform.OS !== 'android') {
    return null;
  }

  const { version: currentVersion, versionCode: currentVersionCode } = getCurrentVersionInfo();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${API_ENDPOINTS.APP_VERSION}?platform=android&v=${encodeURIComponent(currentVersion)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return null;
    }

    const json = await res.json();
    if (!json.success || !json.data) {
      return null;
    }

    const d = json.data;
    const latestVersionCode = typeof d.latestVersionCode === 'number' ? d.latestVersionCode : 1;
    const minSupported = typeof d.minSupportedVersionCode === 'number' ? d.minSupportedVersionCode : 1;
    const isUpdateAvailable = latestVersionCode > currentVersionCode;
    const isMandatory = Boolean(d.isMandatory || currentVersionCode < minSupported);

    const info: NativeReleaseInfo = {
      isUpdateAvailable,
      isMandatory,
      currentVersion,
      currentVersionCode,
      latestVersion: d.latestVersion || currentVersion,
      latestVersionCode,
      apkDownloadUrl: d.apkDownloadUrl || 'https://axiombyte.kauxync.in/download/axiombyte.apk',
      releaseNotes: d.releaseNotes || 'New native performance improvements and optimizations.',
      fileSizeBytes: d.fileSizeBytes,
      releasedAt: d.releasedAt,
    };

    if (isUpdateAvailable) {
      notifyNativeUpdateAvailable(info);
    }

    return info;
  } catch (err) {
    if (__DEV__) console.warn('[NativeUpdate] Version check check failed:', err);
    return null;
  }
}

/**
 * Triggers in-place Android APK upgrade via the system package installer.
 */
export async function openApkInstaller(apkUrl: string): Promise<boolean> {
  try {
    const canOpen = await Linking.canOpenURL(apkUrl);
    if (canOpen) {
      await Linking.openURL(apkUrl);
      return true;
    }
    // Fallback: direct navigation
    await Linking.openURL('https://axiombyte.kauxync.in/download');
    return true;
  } catch (e) {
    console.error('[NativeUpdate] Failed to open APK download link:', e);
    return false;
  }
}
