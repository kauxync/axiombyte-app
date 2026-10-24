import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  saveSecureProfile,
  getSecureProfile,
  clearAllSecureData,
} from './secureStorage';

export interface UserProfile {
  id: string;
  name: string;
  username: string;
  email: string;
  university: string;
  collegeDepartment: string;
  semester: string;
  avatar: string;
  referralCode: string;
  referredBy?: string | null;
  coins: number;
  authProvider: 'email' | 'google' | 'github';
  isEmailVerified?: boolean;
  isProfileCompleted?: boolean;
  createdAt: string;
}

export interface CoinTransaction {
  id: string;
  type:
    | 'referral_bonus'
    | 'signup_referral_reward'
    | 'welcome_bonus'
    | 'lesson_reward'
    | 'streak_reward'
    | 'streak_freeze'
    | 'redeem';
  amount: number;
  inrValue: number; // 100 coins = 1 INR
  description: string;
  timestamp: string;
  status: 'completed' | 'pending';
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string; // 'YYYY-MM-DD'
  todayCompleted: boolean;
  freezeCount: number;
  historyDates: string[]; // List of YYYY-MM-DD
  weeklyActivity: boolean[]; // 7 elements [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
  lostStreak?: number; // Preserved streak value if broken without freeze
  freezeUsedToday?: boolean; // True if a freeze shield was consumed to protect streak today
  streakLostToday?: boolean; // True if streak broke today
}

const STORAGE_KEYS = {
  USER_PROFILE: '@learn_kauxync_user_profile',
  AUTH_TOKEN: '@learn_kauxync_auth_token',
  ONBOARDING_STATUS: '@learn_kauxync_onboarding_done',
  TRANSACTIONS: '@learn_kauxync_transactions',
  STREAK_DATA: '@learn_kauxync_streak_data',
  GLOBAL_REFERRAL_REGISTRY: '@learn_kauxync_referral_registry',
};

// Generate an alphanumeric referral code from username
export function generateReferralCode(username: string): string {
  const clean = username.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 5);
  const randomSuffix = Math.floor(100 + Math.random() * 900); // 3-digit salt
  return `${clean || 'STUDENT'}${randomSuffix}`;
}

export async function getStoredProfile(): Promise<UserProfile | null> {
  try {
    // 1. Try SecureStore first (new secure path)
    const secureRaw = await getSecureProfile();
    if (secureRaw) {
      return JSON.parse(secureRaw);
    }

    // 2. One-time migration: if profile exists in old AsyncStorage, move it to SecureStore
    const legacyRaw = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    if (legacyRaw) {
      await saveSecureProfile(legacyRaw);
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_PROFILE); // remove plaintext copy
      return JSON.parse(legacyRaw);
    }

    return null;
  } catch (e) {
    if (__DEV__) console.error('Error reading profile from storage:', e);
    return null;
  }
}

export async function saveStoredProfile(profile: UserProfile): Promise<void> {
  try {
    // Store PII exclusively in SecureStore — never in plaintext AsyncStorage
    await saveSecureProfile(JSON.stringify(profile));
  } catch (e) {
    if (__DEV__) console.error('Error saving profile to storage:', e);
  }
}

export async function getOnboardingStatus(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_STATUS);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function setOnboardingStatus(done: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_STATUS, done ? 'true' : 'false');
  } catch (e) {
    console.error('Error setting onboarding status:', e);
  }
}

export async function getTransactions(): Promise<CoinTransaction[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveTransaction(tx: CoinTransaction): Promise<void> {
  try {
    const existing = await getTransactions();
    const updated = [tx, ...existing];
    await AsyncStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updated));
  } catch (e) {
    console.error('Error saving transaction:', e);
  }
}

// Clear session storage for logout (preserves device-level onboarding state)
export async function clearAllSessionData(): Promise<void> {
  try {
    // 1. Clear sensitive data from SecureStore (auth token + user profile)
    await clearAllSecureData();

    // 2. Clear non-sensitive session keys from AsyncStorage
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.USER_PROFILE, // legacy key (may be empty after migration)
      STORAGE_KEYS.AUTH_TOKEN,   // legacy key (now managed by SecureStore)
      STORAGE_KEYS.TRANSACTIONS,
      STORAGE_KEYS.STREAK_DATA,
    ]);

    // 3. Clear content and curriculum caches so the next user starts fresh
    //    Dynamic imports avoid circular dependency with contentService/curriculumService
    try {
      const { clearAllContentCaches } = await import('./contentService');
      clearAllContentCaches(); // in-memory only; async keys cleared below
    } catch {}

    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter(
        (k) =>
          k.startsWith('@axiombyte_md_') ||
          k.startsWith('@axiombyte_lab_') ||
          k.startsWith('@axiombyte_curriculum') ||
          k === '@axiombyte_curriculum_last_synced'
      );
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
      }
    } catch {}
  } catch (e) {
    if (__DEV__) console.error('Error clearing storage:', e);
  }
}

// =========================================================================
// STREAK TRACKING & DAILY ENGAGEMENT ENGINE
// =========================================================================

export function getLocalDateString(d = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getYesterdayDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getLocalDateString(d);
}

export function computeCurrentWeekActivity(historyDates: string[]): boolean[] {
  const now = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7; // 0 = Mon, 6 = Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek);

  const datesSet = new Set(historyDates);
  const weekFlags: boolean[] = [];

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + i);
    const dateStr = getLocalDateString(dayDate);
    weekFlags.push(datesSet.has(dateStr));
  }

  return weekFlags;
}

export async function getStreakData(): Promise<StreakData> {
  const today = getLocalDateString();
  const yesterday = getYesterdayDateString();

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.STREAK_DATA);
    if (!raw) {
      const initial: StreakData = {
        currentStreak: 1,
        longestStreak: 1,
        lastActiveDate: today,
        todayCompleted: true,
        freezeCount: 1,
        historyDates: [today],
        weeklyActivity: computeCurrentWeekActivity([today]),
      };
      await AsyncStorage.setItem(STORAGE_KEYS.STREAK_DATA, JSON.stringify(initial));
      return initial;
    }

    const data: StreakData = JSON.parse(raw);
    const history = data.historyDates || (data.lastActiveDate ? [data.lastActiveDate] : []);

    // Check if user is active today
    if (data.lastActiveDate === today) {
      data.todayCompleted = true;
      const fullHistory = Array.from(new Set([today, ...history]));
      data.historyDates = fullHistory;
      data.weeklyActivity = computeCurrentWeekActivity(fullHistory);
      return data;
    }

    // Check if user was active yesterday (streak alive, but needs activity today)
    if (data.lastActiveDate === yesterday) {
      data.todayCompleted = false;
      const cleanHistory = history.filter((d) => d !== today);
      data.historyDates = cleanHistory;
      data.weeklyActivity = computeCurrentWeekActivity(cleanHistory);
      return data;
    }

    // Missed 2+ days: Check if user has streak freeze
    if (data.freezeCount > 0) {
      data.freezeCount -= 1;
      data.lastActiveDate = yesterday;
      data.todayCompleted = false;
      data.freezeUsedToday = true;
      data.weeklyActivity = computeCurrentWeekActivity(history);
      await AsyncStorage.setItem(STORAGE_KEYS.STREAK_DATA, JSON.stringify(data));
      return data;
    }

    // Streak broken: preserve lostStreak for recovery purchase
    if (data.currentStreak > 0) {
      data.lostStreak = data.currentStreak;
      data.streakLostToday = true;
    }
    data.currentStreak = 0;
    data.todayCompleted = false;
    data.weeklyActivity = computeCurrentWeekActivity(history);
    await AsyncStorage.setItem(STORAGE_KEYS.STREAK_DATA, JSON.stringify(data));
    return data;
  } catch (err) {
    console.error('Error reading streak data:', err);
    return {
      currentStreak: 1,
      longestStreak: 1,
      lastActiveDate: today,
      todayCompleted: true,
      freezeCount: 1,
      historyDates: [today],
      weeklyActivity: computeCurrentWeekActivity([today]),
    };
  }
}

export async function saveStreakData(streak: StreakData): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.STREAK_DATA, JSON.stringify(streak));
  } catch (e) {
    console.error('Error saving streak data:', e);
  }
}

/**
 * Records daily learning activity, advances streak, awards coins
 */
export async function recordDailyStreakActivity(): Promise<{
  updatedStreak: StreakData;
  coinsAwarded: number;
  isNewDay: boolean;
  milestoneBonus?: { days: number; bonus: number };
}> {
  const today = getLocalDateString();
  const yesterday = getYesterdayDateString();
  const current = await getStreakData();

  // If already completed today, no extra streak increment
  if (current.todayCompleted && current.lastActiveDate === today) {
    return {
      updatedStreak: current,
      coinsAwarded: 0,
      isNewDay: false,
    };
  }

  // Calculate new streak count
  let newStreak = current.currentStreak;
  if (current.lastActiveDate === yesterday) {
    newStreak += 1;
  } else if (current.lastActiveDate !== today) {
    newStreak = 1; // Restart streak
  }

  const newLongest = Math.max(current.longestStreak, newStreak);
  const updatedHistory = Array.from(new Set([today, ...(current.historyDates || [])]));

  // Coin rewards calculation
  let coinsAwarded = 10; // Standard daily completion bonus
  let milestoneBonus: { days: number; bonus: number } | undefined;

  if (newStreak === 3) {
    milestoneBonus = { days: 3, bonus: 25 };
    coinsAwarded += 25;
  } else if (newStreak === 7) {
    milestoneBonus = { days: 7, bonus: 70 };
    coinsAwarded += 70;
  } else if (newStreak === 14) {
    milestoneBonus = { days: 14, bonus: 150 };
    coinsAwarded += 150;
  } else if (newStreak === 30) {
    milestoneBonus = { days: 30, bonus: 350 };
    coinsAwarded += 350;
  }

  const updatedStreak: StreakData = {
    currentStreak: newStreak,
    longestStreak: newLongest,
    lastActiveDate: today,
    todayCompleted: true,
    freezeCount: current.freezeCount,
    historyDates: updatedHistory,
    weeklyActivity: computeCurrentWeekActivity(updatedHistory),
  };

  await saveStreakData(updatedStreak);

  return {
    updatedStreak,
    coinsAwarded,
    isNewDay: true,
    milestoneBonus,
  };
}

export async function buyStreakFreezeFromStorage(
  cost = 50,
  recoverLost = false
): Promise<{ success: boolean; newFreezeCount: number; restoredStreak?: number; error?: string }> {
  try {
    const profile = await getStoredProfile();
    if (!profile) {
      return { success: false, newFreezeCount: 0, error: 'User not logged in.' };
    }

    if (profile.coins < cost) {
      return {
        success: false,
        newFreezeCount: 0,
        error: `Insufficient coins. You need ${cost} coins (You have ${profile.coins}).`,
      };
    }

    // Deduct coins
    profile.coins -= cost;
    await saveStoredProfile(profile);

    const streak = await getStreakData();
    let restoredStreak = 0;

    if (recoverLost && (streak.lostStreak || 0) > 0) {
      restoredStreak = streak.lostStreak!;
      streak.currentStreak = restoredStreak;
      streak.longestStreak = Math.max(streak.longestStreak, restoredStreak);
      streak.lostStreak = 0;
      streak.todayCompleted = true;
      streak.lastActiveDate = getLocalDateString();
    } else {
      streak.freezeCount += 1;
    }

    await saveStreakData(streak);

    // Save transaction
    const tx: CoinTransaction = {
      id: 'tx_freeze_' + Date.now(),
      type: 'streak_freeze',
      amount: -cost,
      inrValue: -(cost / 100),
      description: recoverLost
        ? `Purchased Streak Freeze & Recovered ${restoredStreak}-Day Streak (-${cost} Coins)`
        : `Purchased 1 Streak Freeze Protection (-${cost} Coins)`,
      timestamp: 'Just now',
      status: 'completed',
    };
    await saveTransaction(tx);

    return { success: true, newFreezeCount: streak.freezeCount, restoredStreak };
  } catch (err: any) {
    return { success: false, newFreezeCount: 0, error: err?.message || 'Failed to purchase freeze.' };
  }
}

export async function recoverLostStreakFromStorage(): Promise<{
  success: boolean;
  restoredStreak?: number;
  newFreezeCount?: number;
  error?: string;
}> {
  try {
    const streak = await getStreakData();
    if (!streak.lostStreak || streak.lostStreak <= 0) {
      return { success: false, error: 'No lost streak to recover.' };
    }
    if (streak.freezeCount <= 0) {
      return { success: false, error: 'No Streak Freeze shields available. Please buy one for 50 coins.' };
    }

    streak.freezeCount -= 1;
    const restored = streak.lostStreak;
    streak.currentStreak = restored;
    streak.longestStreak = Math.max(streak.longestStreak, restored);
    streak.lostStreak = 0;
    streak.todayCompleted = true;
    streak.lastActiveDate = getLocalDateString();

    await saveStreakData(streak);

    return { success: true, restoredStreak: restored, newFreezeCount: streak.freezeCount };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to restore streak.' };
  }
}


