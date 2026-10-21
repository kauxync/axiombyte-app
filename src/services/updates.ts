import * as Updates from 'expo-updates';

export interface AppUpdateCheckResult {
  isAvailable: boolean;
  isDev: boolean;
  error?: string;
  manifest?: any;
}

/**
 * Checks if a new Over-The-Air (OTA) update is available on EAS.
 * In development builds (__DEV__), updates are not available.
 */
export async function checkAppUpdate(): Promise<AppUpdateCheckResult> {
  if (__DEV__) {
    return {
      isAvailable: false,
      isDev: true,
      error: 'In-app OTA updates are disabled in development mode.',
    };
  }

  if (!Updates.isEnabled) {
    return {
      isAvailable: false,
      isDev: false,
      error: 'Updates are not enabled for this build.',
    };
  }

  try {
    const update = await Updates.checkForUpdateAsync();
    return {
      isAvailable: !!update.isAvailable,
      isDev: false,
      manifest: update.manifest,
    };
  } catch (err: any) {
    return {
      isAvailable: false,
      isDev: false,
      error: err?.message || 'Could not connect to update service.',
    };
  }
}

/**
 * Downloads the latest update bundle and instantly reloads the app.
 * No APK reinstallation needed!
 */
export async function downloadAndReloadUpdate(): Promise<{ success: boolean; error?: string }> {
  if (__DEV__ || !Updates.isEnabled) {
    return { success: false, error: 'Cannot update in dev or disabled mode.' };
  }

  try {
    const fetchResult = await Updates.fetchUpdateAsync();
    if (fetchResult.isNew) {
      await Updates.reloadAsync();
      return { success: true };
    }
    return { success: false, error: 'No new update bundle returned.' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to download update bundle.' };
  }
}

/**
 * Returns diagnostic metadata about the currently running update.
 */
export function getCurrentUpdateInfo() {
  return {
    isEnabled: Updates.isEnabled,
    updateId: Updates.updateId || null,
    channel: Updates.channel || null,
    runtimeVersion: Updates.runtimeVersion || null,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    createdAt: Updates.createdAt ? new Date(Updates.createdAt).toLocaleString() : null,
  };
}

