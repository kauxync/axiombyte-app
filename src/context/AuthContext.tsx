import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  UserProfile,
  CoinTransaction,
  StreakData,
  getStoredProfile,
  saveStoredProfile,
  getOnboardingStatus,
  setOnboardingStatus,
  getTransactions,
  saveTransaction,
  clearAllSessionData,
  generateReferralCode,
  getStreakData,
  saveStreakData,
  recordDailyStreakActivity,
  buyStreakFreezeFromStorage,
  recoverLostStreakFromStorage,
  getLocalDateString,
  computeCurrentWeekActivity,
} from '@/services/storage';
import {
  sendEmailVerificationCode,
  verifyEmailCode,
  registerWithApi,
  loginWithApi,
  updateProfileWithApi,
  deleteAccountWithApi,
  syncRewardTransactionWithApi,
  syncOnlineStreakWithApi,
  purchaseStreakFreezeApi,
  recoverStreakWithFreezeApi,
  recordDailyStreakActivityApi,
} from '@/services/api';
import { signInWithGoogle, signInWithGithub } from '@/services/oauth';
import { saveAuthToken, deleteAuthToken } from '@/services/secureStorage';
import { registerDeviceTelemetry } from '@/services/deviceTelemetryService';

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  isProfileComplete: boolean;
  isLoading: boolean;
  transactions: CoinTransaction[];
  streak: StreakData;
  completeOnboarding: () => Promise<void>;
  recordStreakActivity: () => Promise<{
    success: boolean;
    coinsAwarded: number;
    newStreak: number;
    milestoneBonus?: { days: number; bonus: number };
  }>;
  buyStreakFreeze: (recoverLost?: boolean) => Promise<{ success: boolean; error?: string; restoredStreak?: number }>;
  recoverLostStreak: () => Promise<{ success: boolean; error?: string; restoredStreak?: number }>;
  checkInOnlineStreak: (targetUser?: UserProfile | null) => Promise<void>;
  sendEmailVerification: (email: string) => Promise<{ success: boolean; message: string; debugCode?: string }>;
  signUpWithEmail: (email: string, pass: string, verificationCode: string) => Promise<{ success: boolean; error?: string }>;
  loginWithEmail: (email: string, pass: string) => Promise<{
    success: boolean;
    error?: string;
    requiresEmailVerification?: boolean;
    email?: string;
  }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  loginWithGithub: () => Promise<{ success: boolean; error?: string }>;
  setAuthenticatedUser: (profile: UserProfile) => Promise<void>;
  updateProfile: (data: {
    name: string;
    username: string;
    university: string;
    collegeDepartment: string;
    semester: string;
    avatar: string;
    appliedReferralCode?: string;
  }) => Promise<{ success: boolean; error?: string; coinsBonus?: number }>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<{ success: boolean; error?: string }>;
  simulateFriendReferral: () => Promise<number>; // Adds 200 coins for testing referral engine
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const userRef = useRef<UserProfile | null>(null);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const [isOnboarded, setIsOnboarded] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [streak, setStreak] = useState<StreakData>({
    currentStreak: 1,
    longestStreak: 1,
    lastActiveDate: getLocalDateString(),
    todayCompleted: true,
    freezeCount: 1,
    historyDates: [getLocalDateString()],
    weeklyActivity: computeCurrentWeekActivity([getLocalDateString()]),
  });

  // Online Streak Check-In (WhatsApp-style automatic check-in when user comes online)
  const checkInOnlineStreak = useCallback(async (targetUser?: UserProfile | null) => {
    const activeUser = targetUser !== undefined ? targetUser : userRef.current;
    if (!activeUser?.id) return;
    registerDeviceTelemetry(activeUser.id).catch(() => {});

    try {
      const res = await syncOnlineStreakWithApi(activeUser.id);
      if (res.success && res.data) {
        const d = res.data;
        const currentData = await getStreakData();
        const historyBase = (currentData.historyDates || []).filter(Boolean);
        const updatedHistory = d.todayCompleted && d.lastActiveDate
          ? Array.from(new Set([d.lastActiveDate, ...historyBase]))
          : historyBase;

        const syncedStreak: StreakData = {
          currentStreak: d.currentStreak,
          longestStreak: d.longestStreak,
          lastActiveDate: d.lastActiveDate,
          todayCompleted: d.todayCompleted,
          freezeCount: d.freezeCount,
          lostStreak: d.lostStreak,
          freezeUsedToday: d.freezeUsedToday,
          streakLostToday: d.streakLostToday,
          historyDates: updatedHistory,
          weeklyActivity: computeCurrentWeekActivity(updatedHistory),
        };

        setStreak(syncedStreak);
        await saveStreakData(syncedStreak);

        // Update coins if awarded or altered
        if (d.coins !== undefined && d.coins !== activeUser.coins) {
          const syncedUser = { ...activeUser, coins: d.coins };
          setUser(syncedUser);
          await saveStoredProfile(syncedUser);
        }

        if (d.coinsAwarded && d.coinsAwarded > 0) {
          const freshTx = await getTransactions();
          setTransactions(freshTx);
        }
        return;
      }
    } catch (e) {
      if (__DEV__) console.warn('[Streak] Remote sync failed, using offline streak logic:', e);
    }

    // Local fallback check-in if server is offline
    const local = await recordDailyStreakActivity();
    setStreak(local.updatedStreak);
    if (local.coinsAwarded > 0 && activeUser) {
      const updatedCoins = activeUser.coins + local.coinsAwarded;
      const updatedUser = { ...activeUser, coins: updatedCoins };
      setUser(updatedUser);
      await saveStoredProfile(updatedUser);
    }
  }, []);

  // Load session & streak from storage on app mount (runs ONCE on launch)
  useEffect(() => {
    async function initSession() {
      try {
        const [storedUser, onboarded, txList, streakData] = await Promise.all([
          getStoredProfile(),
          getOnboardingStatus(),
          getTransactions(),
          getStreakData(),
        ]);

        setUser(storedUser);
        setIsOnboarded(onboarded);
        setTransactions(txList);
        setStreak(streakData);

        // WhatsApp-style automatic online check-in on app open
        if (storedUser?.id) {
          checkInOnlineStreak(storedUser).catch(() => {});
          registerDeviceTelemetry(storedUser.id).catch(() => {});
        }
      } catch (err) {
        console.error('Failed to initialize auth session:', err);
      } finally {
        setIsLoading(false);
      }
    }

    initSession();
  }, [checkInOnlineStreak]);

  // Sync streak whenever app comes to active foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        const currentActive = userRef.current;
        if (currentActive?.id) {
          checkInOnlineStreak(currentActive).catch(() => {});
        }
      }
    });
    return () => subscription.remove();
  }, [checkInOnlineStreak]);

  const completeOnboarding = async () => {
    setIsOnboarded(true);
    await setOnboardingStatus(true);
  };

  /**
   * Request 6-digit email verification code via Hostinger PHP mail API
   */
  const sendEmailVerification = async (email: string) => {
    if (!email || !email.includes('@')) {
      return { success: false, message: 'Please enter a valid email address.' };
    }

    try {
      const res = await sendEmailVerificationCode(email.trim().toLowerCase());
      return {
        success: res.success,
        message: res.message,
        // Only expose debugCode in dev builds — never in production
        debugCode: __DEV__ ? res.data?.debugCode : undefined,
      };
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'Could not send verification email.',
      };
    }
  };

  /**
   * Complete Sign Up after user enters 6-digit verification code
   */
  const signUpWithEmail = async (email: string, pass: string, verificationCode: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = verificationCode.trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (!pass || pass.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' };
    }
    if (!cleanCode || cleanCode.length !== 6) {
      return { success: false, error: 'Please enter a valid 6-digit verification code.' };
    }

    // 1. Verify code with Hostinger backend (or fallback)
    const verifyRes = await verifyEmailCode(cleanEmail, cleanCode);
    if (!verifyRes.success) {
      return { success: false, error: verifyRes.message || 'Invalid or expired verification code.' };
    }

    // 2. Register account on Hostinger MySQL
    const usernamePrefix = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
    const apiRes = await registerWithApi({
      email: cleanEmail,
      password: pass,
      username: usernamePrefix + Math.floor(100 + Math.random() * 900),
    });

    if (!apiRes.success && apiRes.message?.toLowerCase().includes('already exists')) {
      // Account already exists in DB (e.g. unverified user signing in). Now that code is verified, sign in.
      const loginRes = await loginWithApi({ email: cleanEmail, password: pass });
      if (loginRes.success && loginRes.data) {
        const serverUser = loginRes.data;
        const userProfile: UserProfile = {
          id: serverUser.id,
          name: serverUser.name || '',
          username: serverUser.username,
          email: serverUser.email,
          university: serverUser.university || '',
          collegeDepartment: serverUser.collegeDepartment || '',
          semester: serverUser.semester || '',
          avatar: serverUser.avatar || '',
          referralCode: serverUser.referralCode,
          referredBy: serverUser.referredBy || null,
          coins: serverUser.coins || 200,
          authProvider: 'email',
          isEmailVerified: true,
          isProfileCompleted: !!serverUser.isProfileCompleted,
          createdAt: new Date().toISOString(),
        };
        setUser(userProfile);
        await saveStoredProfile(userProfile);
        return { success: true };
      }
    }

    const userId = apiRes.data?.id || 'usr_' + Date.now();
    const finalUsername = apiRes.data?.username || usernamePrefix;
    const referralCode = apiRes.data?.referralCode || generateReferralCode(finalUsername);

    // Initial 200 welcome bonus coins (200 coins = 2 INR)
    const initialCoins = apiRes.data?.coins || 200;

    const newUser: UserProfile = {
      id: userId,
      name: '',
      username: finalUsername,
      email: cleanEmail,
      university: '',
      collegeDepartment: '',
      semester: '',
      avatar: '',
      referralCode,
      coins: initialCoins,
      authProvider: 'email',
      isEmailVerified: true,
      isProfileCompleted: false,
      createdAt: new Date().toISOString(),
    };

    const welcomeTx: CoinTransaction = {
      id: 'tx_welcome_' + Date.now(),
      type: 'welcome_bonus',
      amount: 200,
      inrValue: 2.0,
      description: 'Welcome Bonus: 200 Coins for joining AxiomByte',
      timestamp: 'Just now',
      status: 'completed',
    };

    setUser(newUser);
    setTransactions([welcomeTx]);
    await saveStoredProfile(newUser);
    await saveTransaction(welcomeTx);
    checkInOnlineStreak(newUser).catch(() => {});

    return { success: true };
  };

  /**
   * Sign In with Email and Password
   */
  const loginWithEmail = async (email: string, pass: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (!pass) {
      return { success: false, error: 'Password is required.' };
    }

    // 1. Try remote Hostinger login API first
    const apiRes = await loginWithApi({ email: cleanEmail, password: pass });
    if (apiRes.success && apiRes.data) {
      const serverUser = apiRes.data;

      // Check if email is verified
      const isVerified = serverUser.isEmailVerified !== false;
      if (!isVerified) {
        return {
          success: false,
          requiresEmailVerification: true,
          email: cleanEmail,
          error: 'Your email address is not verified yet. A 6-digit verification code is required to activate your account.',
        };
      }

      const userProfile: UserProfile = {
        id: serverUser.id,
        name: serverUser.name || '',
        username: serverUser.username,
        email: serverUser.email,
        university: serverUser.university || '',
        collegeDepartment: serverUser.collegeDepartment || '',
        semester: serverUser.semester || '',
        avatar: serverUser.avatar || '',
        referralCode: serverUser.referralCode,
        referredBy: serverUser.referredBy || null,
        coins: serverUser.coins || 200,
        authProvider: 'email',
        isEmailVerified: true,
        isProfileCompleted: !!serverUser.isProfileCompleted,
        createdAt: new Date().toISOString(),
      };
      setUser(userProfile);
      await saveStoredProfile(userProfile);
      checkInOnlineStreak(userProfile).catch(() => {});
      // Persist auth token returned by server for future authenticated API calls
      if (apiRes.data?.token) {
        await saveAuthToken(apiRes.data.token);
      }
      return { success: true };
    }

    // 2. If remote API returned a definitive error (wrong password, unknown user), surface it
    if (!apiRes.isMockFallback && !apiRes.success) {
      return { success: false, error: apiRes.message };
    }

    // 3. Server unreachable (isMockFallback === true): fail closed in all builds.
    //    We must NOT authenticate without a verified password — even in dev mode.
    //    An offline placeholder session would allow anyone knowing the email to log in.
    if (apiRes.isMockFallback) {
      return {
        success: false,
        error: 'Cannot connect to authentication server. Please check your internet connection and try again.',
      };
    }

    return { success: false, error: apiRes.message || 'Authentication failed.' };
  };

  /**
   * Directly sets and persists authenticated user session (used by deep links and OAuth callbacks)
   */
  const setAuthenticatedUser = async (profile: UserProfile) => {
    setUser(profile);
    await saveStoredProfile(profile);
    checkInOnlineStreak(profile).catch(() => {});
  };

  const loginWithGoogle = async () => {
    try {
      const res = await signInWithGoogle();
      if (res.success && res.user) {
        await setAuthenticatedUser(res.user);
        return { success: true };
      }
      return { success: false, error: res.error || 'Google login failed.' };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Google sign-in error.' };
    }
  };

  const loginWithGithub = async () => {
    try {
      const res = await signInWithGithub();
      if (res.success && res.user) {
        await setAuthenticatedUser(res.user);
        return { success: true };
      }
      return { success: false, error: res.error || 'GitHub login failed.' };
    } catch (e: any) {
      return { success: false, error: e?.message || 'GitHub sign-in error.' };
    }
  };

  const updateProfile = async (data: {
    name: string;
    username: string;
    university: string;
    collegeDepartment: string;
    semester: string;
    avatar: string;
    appliedReferralCode?: string;
  }) => {
    if (!user) {
      return { success: false, error: 'User session not found.' };
    }

    let initialCoins = user.coins;
    let newTransactions = [...transactions];
    let bonusAwarded = 0;

    // Check referral code if provided
    if (data.appliedReferralCode && data.appliedReferralCode.trim().length > 3) {
      const code = data.appliedReferralCode.trim().toUpperCase();
      if (code === user.referralCode) {
        return { success: false, error: 'You cannot use your own referral code!' };
      }

      // Valid referral code applied: New student gets 100 Coins (₹1.00)
      bonusAwarded = 100;
      initialCoins += bonusAwarded;

      const refTx: CoinTransaction = {
        id: 'tx_ref_' + Date.now(),
        type: 'signup_referral_reward',
        amount: 100,
        inrValue: 1.0,
        description: `Referral Welcome Bonus from code ${code} (100 Coins = ₹1.00)`,
        timestamp: 'Just now',
        status: 'completed',
      };

      newTransactions.unshift(refTx);
      await saveTransaction(refTx);
    }

    // Sync with Hostinger MySQL backend
    await updateProfileWithApi({
      userId: user.id,
      name: data.name.trim(),
      username: data.username.trim(),
      university: data.university.trim(),
      collegeDepartment: data.collegeDepartment.trim(),
      semester: data.semester,
      avatar: data.avatar,
    });

    const updatedProfile: UserProfile = {
      ...user,
      name: data.name.trim(),
      username: data.username.trim(),
      university: data.university.trim(),
      collegeDepartment: data.collegeDepartment.trim(),
      semester: data.semester,
      avatar: data.avatar,
      referralCode: user.referralCode || generateReferralCode(data.username),
      referredBy: data.appliedReferralCode?.trim() || null,
      coins: initialCoins,
      isProfileCompleted: true,
    };

    setUser(updatedProfile);
    setTransactions(newTransactions);
    await saveStoredProfile(updatedProfile);

    return { success: true, coinsBonus: bonusAwarded };
  };

  // DEV-ONLY: Simulates a friend using your referral code.
  // This function is intentionally disabled in production builds to prevent
  // client-side coin minting. Guarded at both the context and UI level.
  const simulateFriendReferral = async (): Promise<number> => {
    if (!__DEV__) {
      console.warn('[AxiomByte] simulateFriendReferral is disabled in production builds.');
      return user?.coins ?? 0;
    }
    if (!user) return 0;

    const reward = 200; // 1 referral = 200 coins = 2 INR
    const updatedCoins = user.coins + reward;

    const tx: CoinTransaction = {
      id: 'tx_ref_earn_' + Date.now(),
      type: 'referral_bonus',
      amount: reward,
      inrValue: reward / 100,
      description: `Friend joined using code ${user.referralCode} (+200 Coins = ₹2.00)`,
      timestamp: 'Just now',
      status: 'completed',
    };

    const updatedUser = { ...user, coins: updatedCoins };
    setUser(updatedUser);
    setTransactions((prev) => [tx, ...prev]);

    await saveStoredProfile(updatedUser);
    await saveTransaction(tx);

    return updatedCoins;
  };

  /**
   * Records daily study/practice activity, increments streak, and awards coins
   */
  const recordStreakActivity = async () => {
    const result = await recordDailyStreakActivity();
    setStreak(result.updatedStreak);

    if (result.coinsAwarded > 0 && user) {
      const updatedCoins = user.coins + result.coinsAwarded;
      const updatedUser = { ...user, coins: updatedCoins };
      setUser(updatedUser);
      await saveStoredProfile(updatedUser);

      const tx: CoinTransaction = {
        id: 'tx_streak_' + Date.now(),
        type: 'streak_reward',
        amount: result.coinsAwarded,
        inrValue: result.coinsAwarded / 100,
        description: result.milestoneBonus
          ? `🔥 ${result.milestoneBonus.days}-Day Streak Milestone Bonus! (+${result.coinsAwarded} Coins)`
          : `🔥 Day ${result.updatedStreak.currentStreak} Daily Streak Bonus (+${result.coinsAwarded} Coins)`,
        timestamp: 'Just now',
        status: 'completed',
      };

      await saveTransaction(tx);
      setTransactions((prev) => [tx, ...prev]);

      // Sync streak activity & transaction with backend
      if (user.id) {
        recordDailyStreakActivityApi(user.id).then((streakRes) => {
          if (streakRes.success && streakRes.data) {
            const d = streakRes.data;
            setStreak((prev) => ({
              ...prev,
              currentStreak: d.currentStreak,
              longestStreak: d.longestStreak,
              lastActiveDate: d.lastActiveDate,
              todayCompleted: d.todayCompleted,
              freezeCount: d.freezeCount,
              lostStreak: d.lostStreak,
            }));
          }
        }).catch(() => {});

        syncRewardTransactionWithApi({
          userId: user.id,
          type: tx.type,
          amount: tx.amount,
          description: tx.description,
        }).then((apiRes) => {
          if (apiRes.data?.verifiedBalance !== undefined) {
            const syncedUser = { ...user, coins: apiRes.data.verifiedBalance };
            setUser(syncedUser);
            saveStoredProfile(syncedUser).catch(() => {});
          }
        }).catch(() => {});
      }
    }

    return {
      success: true,
      coinsAwarded: result.coinsAwarded,
      newStreak: result.updatedStreak.currentStreak,
      milestoneBonus: result.milestoneBonus,
    };
  };



  /**
   * Buys a Streak Freeze shield using 50 coins (optionally recovering a lost streak)
   */
  const buyStreakFreeze = async (recoverLost = false) => {
    if (!user?.id) return { success: false, error: 'User not logged in' };

    try {
      const res = await purchaseStreakFreezeApi(user.id, recoverLost);
      if (res.success && res.data) {
        const d = res.data;
        const currentData = await getStreakData();
        const updatedHistory = Array.from(new Set([d.lastActiveDate, ...(currentData.historyDates || [])]));

        const syncedStreak: StreakData = {
          currentStreak: d.currentStreak,
          longestStreak: d.longestStreak,
          lastActiveDate: d.lastActiveDate,
          todayCompleted: d.todayCompleted,
          freezeCount: d.freezeCount,
          lostStreak: d.lostStreak,
          historyDates: updatedHistory,
          weeklyActivity: computeCurrentWeekActivity(updatedHistory),
        };

        setStreak(syncedStreak);
        await saveStreakData(syncedStreak);

        const updatedUser = { ...user, coins: d.coins };
        setUser(updatedUser);
        await saveStoredProfile(updatedUser);

        const freshTx = await getTransactions();
        setTransactions(freshTx);

        return { success: true, restoredStreak: d.currentStreak };
      }
    } catch (e) {
      if (__DEV__) console.warn('[Streak] Remote purchase failed, trying local:', e);
    }

    // Fallback to local storage if API is unreachable
    const localRes = await buyStreakFreezeFromStorage(50, recoverLost);
    if (localRes.success) {
      const freshStreak = await getStreakData();
      setStreak(freshStreak);
      if (user) {
        const updatedCoins = Math.max(0, user.coins - 50);
        const updatedUser = { ...user, coins: updatedCoins };
        setUser(updatedUser);
        await saveStoredProfile(updatedUser);
      }
      const freshTx = await getTransactions();
      setTransactions(freshTx);
      return { success: true, restoredStreak: localRes.restoredStreak };
    }
    return { success: false, error: localRes.error };
  };

  /**
   * Recovers a broken streak using an available Streak Freeze shield
   */
  const recoverLostStreak = async () => {
    if (!user?.id) return { success: false, error: 'User not logged in' };

    try {
      const res = await recoverStreakWithFreezeApi(user.id);
      if (res.success && res.data) {
        const d = res.data;
        const currentData = await getStreakData();
        const updatedHistory = Array.from(new Set([d.lastActiveDate, ...(currentData.historyDates || [])]));

        const syncedStreak: StreakData = {
          currentStreak: d.currentStreak,
          longestStreak: d.longestStreak,
          lastActiveDate: d.lastActiveDate,
          todayCompleted: d.todayCompleted,
          freezeCount: d.freezeCount,
          lostStreak: 0,
          historyDates: updatedHistory,
          weeklyActivity: computeCurrentWeekActivity(updatedHistory),
        };

        setStreak(syncedStreak);
        await saveStreakData(syncedStreak);

        return { success: true, restoredStreak: d.currentStreak };
      }
    } catch {}

    const localRes = await recoverLostStreakFromStorage();
    if (localRes.success) {
      const freshStreak = await getStreakData();
      setStreak(freshStreak);
      return { success: true, restoredStreak: localRes.restoredStreak };
    }
    return { success: false, error: localRes.error };
  };

  const logout = async () => {
    await clearAllSessionData(); // clears SecureStore + AsyncStorage session keys
    await deleteAuthToken();     // belt-and-suspenders: explicitly remove token
    setUser(null);
    setTransactions([]);
  };

  /**
   * Permanently deletes user account, remote DB records, and local storage
   * GDPR Article 17 / India DPDP Right to Erasure.
   */
  const deleteAccount = async () => {
    try {
      if (user?.id) {
        await deleteAccountWithApi(user.id);
      }
      await clearAllSessionData();
      await deleteAuthToken();
      setUser(null);
      setTransactions([]);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Could not complete account deletion.' };
    }
  };

  const isAuthenticated = !!user;
  const isProfileComplete = !!(
    user &&
    (user.isProfileCompleted !== undefined
      ? user.isProfileCompleted === true
      : !!(
          user.name?.trim() &&
          user.username?.trim() &&
          user.university?.trim() &&
          user.collegeDepartment?.trim() &&
          user.semester?.trim() &&
          user.avatar?.trim()
        ))
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isOnboarded,
        isProfileComplete,
        isLoading,
        transactions,
        streak,
        recordStreakActivity,
        buyStreakFreeze,
        recoverLostStreak,
        checkInOnlineStreak,
        completeOnboarding,
        sendEmailVerification,
        signUpWithEmail,
        loginWithEmail,
        loginWithGoogle,
        loginWithGithub,
        setAuthenticatedUser,
        updateProfile,
        logout,
        deleteAccount,
        simulateFriendReferral,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
