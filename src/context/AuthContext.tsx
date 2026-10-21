import React, { createContext, useContext, useState, useEffect } from 'react';
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
  recordDailyStreakActivity,
  buyStreakFreezeFromStorage,
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
} from '@/services/api';
import { signInWithGoogle, signInWithGithub } from '@/services/oauth';
import { saveAuthToken, deleteAuthToken } from '@/services/secureStorage';

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
  buyStreakFreeze: () => Promise<{ success: boolean; error?: string }>;
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

  // Load session & streak from storage on app mount
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
      } catch (err) {
        console.error('Failed to initialize auth session:', err);
      } finally {
        setIsLoading(false);
      }
    }

    initSession();
  }, []);

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

  const loginWithGoogle = async () => {
    try {
      const res = await signInWithGoogle();
      if (res.success && res.user) {
        setUser(res.user);
        await saveStoredProfile(res.user);
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
        setUser(res.user);
        await saveStoredProfile(res.user);
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

      // Sync transaction with backend — adopt server authoritative balance if returned
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

    return {
      success: true,
      coinsAwarded: result.coinsAwarded,
      newStreak: result.updatedStreak.currentStreak,
      milestoneBonus: result.milestoneBonus,
    };
  };

  /**
   * Buys a Streak Freeze shield using 50 coins
   */
  const buyStreakFreeze = async () => {
    const res = await buyStreakFreezeFromStorage(50);
    if (res.success) {
      const freshStreak = await getStreakData();
      setStreak(freshStreak);
      if (user) {
        const updatedCoins = Math.max(0, user.coins - 50);
        const updatedUser = { ...user, coins: updatedCoins };
        setUser(updatedUser);
        await saveStoredProfile(updatedUser);

        // Sync coin deduction with backend
        syncRewardTransactionWithApi({
          userId: user.id,
          type: 'streak_freeze',
          amount: -50,
          description: 'Purchased 1 Streak Freeze Protection (-50 Coins)',
        }).then((apiRes) => {
          if (apiRes.data?.verifiedBalance !== undefined) {
            const syncedUser = { ...user, coins: apiRes.data.verifiedBalance };
            setUser(syncedUser);
            saveStoredProfile(syncedUser).catch(() => {});
          }
        }).catch(() => {});
      }
      const freshTx = await getTransactions();
      setTransactions(freshTx);
      return { success: true };
    }
    return { success: false, error: res.error };
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
        completeOnboarding,
        sendEmailVerification,
        signUpWithEmail,
        loginWithEmail,
        loginWithGoogle,
        loginWithGithub,
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
