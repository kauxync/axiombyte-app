import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';
import type * as NotificationsType from 'expo-notifications';

let notificationsModule: typeof NotificationsType | null = null;
let isHandlerConfigured = false;

/**
 * Checks whether native notification modules are present and safe to load.
 * In Expo Go on Android (SDK 53+), remote notification modules like 'ExpoTopicSubscriptionModule'
 * are not compiled into the pre-built Expo Go binary.
 */
function isNotificationModuleAvailable(): boolean {
  if (Platform.OS === 'web') {
    return false;
  }

  // Check 1: Expo Go client check
  if (
    Constants.appOwnership === 'expo' ||
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  ) {
    return false;
  }

  // Check 2: Verify required native module is registered before loading
  if (Platform.OS === 'android') {
    try {
      const topicModule = requireOptionalNativeModule('ExpoTopicSubscriptionModule');
      if (!topicModule) {
        return false;
      }
    } catch {
      return false;
    }
  }

  return true;
}

function getNotifications(): typeof NotificationsType | null {
  if (notificationsModule) {
    return notificationsModule;
  }

  if (!isNotificationModuleAvailable()) {
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-notifications') as typeof NotificationsType;
    if (mod && !isHandlerConfigured && typeof mod.setNotificationHandler === 'function') {
      mod.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      isHandlerConfigured = true;
    }
    notificationsModule = mod;
    return notificationsModule;
  } catch (error) {
    if (__DEV__) {
      console.warn('[NotificationService] Failed to load expo-notifications:', error);
    }
    return null;
  }
}

/**
 * Requests notification permissions from the operating system (iOS / Android).
 * Safe across platforms and development environments.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const Notifications = getNotifications();
  if (!Notifications) {
    return false;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return false;
    }

    // Android 8.0+ channel setup
    if (Platform.OS === 'android') {
      const importanceMax = Notifications.AndroidImportance?.MAX ?? 7;
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: importanceMax,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0284C7',
      });
    }

    return true;
  } catch (error) {
    if (__DEV__) {
      console.warn('[NotificationService] Error requesting notification permissions:', error);
    }
    return false;
  }
}

/**
 * Checks current notification permission status.
 */
export async function getNotificationPermissionStatus(): Promise<boolean> {
  const Notifications = getNotifications();
  if (!Notifications) {
    return false;
  }

  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}
