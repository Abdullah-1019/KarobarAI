// Profile screens — view, settings (incl. Feature 3's Store/Brand tab for Sellers), change
// password. EditProfilePage (Feature 2) was retired in Feature 3 — storeName/storeDescription
// editing now lives in the Store/Brand tab (SettingsPage -> StoreBrandTab) instead of a separate
// page, since a second edit surface for the same two fields would be pure duplicate maintenance.
export { ProfilePage } from './ProfilePage';
export { SettingsPage } from './SettingsPage';
export { ChangePasswordPage } from './ChangePasswordPage';
