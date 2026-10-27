/**
 * Backward compatibility re-export.
 * The profile implementation has been completely redesigned and modularized into:
 * - ProfilePage.tsx (Main Profile view)
 * - profile/EditProfilePage.tsx
 * - profile/WalletPage.tsx
 * - profile/SettingsPage.tsx
 * - profile/AppInfoPage.tsx
 * - profile/LegalPolicyPage.tsx
 */
export { ProfilePage as ProfileWalletView, ProfilePage } from './ProfilePage';
