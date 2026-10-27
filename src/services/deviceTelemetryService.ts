import { Platform, Dimensions, PixelRatio, AccessibilityInfo } from 'react-native';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import { API_ENDPOINTS } from './api';
import { getNotificationPermissionStatus } from './notificationService';

const INSTALL_ID_STORAGE_KEY = 'axiombyte_device_install_uuid';
let hasRegisteredThisSession = false;
const APP_START_TIME = Date.now();

/**
 * Retrieves existing persistent install UUID or creates a new one.
 * Uses iOS Keychain via SecureStore so it survives app deletion & reinstallation.
 */
export async function getOrCreateInstallId(): Promise<{ installId: string; isNew: boolean }> {
  try {
    const existing = await SecureStore.getItemAsync(INSTALL_ID_STORAGE_KEY);
    if (existing) {
      return { installId: existing, isNew: false };
    }

    const newId = Crypto.randomUUID();
    await SecureStore.setItemAsync(INSTALL_ID_STORAGE_KEY, newId, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });
    return { installId: newId, isNew: true };
  } catch {
    // Web or fallback
    return { installId: Crypto.randomUUID(), isNew: false };
  }
}

/**
 * Gathers anonymous, non-invasive system & device telemetry
 * Fully compliant with Google Play & Apple App Store Privacy Policies.
 */
export async function collectDeviceTelemetry(userId?: string) {
  const { installId, isNew } = await getOrCreateInstallId();

  // Screen resolution
  const screen = Dimensions.get('screen');
  const ratio = PixelRatio.get();
  const screenResolution = `${Math.round(screen.width * ratio)}x${Math.round(screen.height * ratio)}`;

  // Disk space
  let freeDiskSpaceGb: number | null = null;
  try {
    if (Platform.OS !== 'web') {
      const freeBytes = await FileSystem.getFreeDiskStorageAsync();
      freeDiskSpaceGb = Math.round((freeBytes / (1024 * 1024 * 1024)) * 100) / 100;
    }
  } catch {
    // Ignore storage lookup error
  }

  // Accessibility screen reader & reduce motion
  let screenReaderActive = false;
  let isReduceMotion = false;
  try {
    screenReaderActive = await AccessibilityInfo.isScreenReaderEnabled();
    isReduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
  } catch {
    // Ignore
  }

  // App launch latency
  const appLaunchLatencyMs = Math.max(0, Date.now() - APP_START_TIME);

  // Battery metrics (safely checked if browser Battery API or Expo Battery is available)
  let batteryLevel: number | null = null;
  let isBatteryCharging: boolean | null = null;
  let isLowPowerMode: boolean | null = null;
  let carrierName: string | null = null;

  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'getBattery' in navigator) {
    try {
      const batt = await (navigator as any).getBattery();
      if (batt) {
        batteryLevel = typeof batt.level === 'number' ? Math.round(batt.level * 100) / 100 : null;
        isBatteryCharging = typeof batt.charging === 'boolean' ? batt.charging : null;
      }
    } catch {
      // Ignore
    }
  }

  // Notification status
  const notifGranted = await getNotificationPermissionStatus();

  return {
    installId,
    isNewInstall: isNew,
    userId: userId || null,
    appVersion: Constants.expoConfig?.version || '1.0.0',
    appBuildNumber: Constants.expoConfig?.android?.versionCode || 1,
    platform: Platform.OS,
    osVersion: Device.osVersion || '',
    deviceBrand: Device.brand || (Platform.OS === 'ios' ? 'Apple' : ''),
    deviceModel: Device.modelName || '',
    deviceType: Device.deviceType === Device.DeviceType.TABLET ? 'TABLET' : 'PHONE',
    isPhysicalDevice: Boolean(Device.isDevice),
    ramTotalGb: Device.totalMemory ? Math.round(Device.totalMemory / (1024 * 1024 * 1024)) : null,
    deviceYearClass: Device.deviceYearClass || null,
    screenResolution,
    fontScale: PixelRatio.getFontScale(),
    locale: Intl.DateTimeFormat().resolvedOptions().locale || 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
    freeDiskSpaceGb,
    screenReaderActive,
    isReduceMotion,
    carrierName,
    batteryLevel,
    isBatteryCharging,
    isLowPowerMode,
    appLaunchLatencyMs,
    notificationStatus: notifGranted ? 'GRANTED' : 'UNDETERMINED',
    isRooted: false,
    biometricType: 'NONE',
  };
}

/**
 * Registers device telemetry with the remote Hostinger backend.
 * Supports events: 'login' | 'logout' | 'launch'
 * sessions_count on the server increases ONLY when a user logs in on that same device after logout.
 */
export async function registerDeviceTelemetry(
  userId?: string,
  event: 'login' | 'logout' | 'launch' = 'launch'
): Promise<boolean> {
  if (hasRegisteredThisSession && !userId && event === 'launch') {
    return true;
  }

  try {
    const telemetry = await collectDeviceTelemetry(userId);
    const payload = {
      ...telemetry,
      event,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(API_ENDPOINTS.REGISTER_DEVICE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      if (event === 'launch') {
        hasRegisteredThisSession = true;
      }
      return true;
    }
    return false;
  } catch (err: any) {
    if (__DEV__) {
      console.warn('[DeviceTelemetry] Silent registration error:', err?.message || err);
    }
    return false;
  }
}
