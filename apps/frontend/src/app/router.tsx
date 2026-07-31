import { Navigate, createBrowserRouter } from 'react-router-dom';

import { EmptyState } from '../components';
import { AdminPlaceholder } from '../features/admin';
import { ForgotPasswordPage, LoginPage, OtpVerifyPage, RegisterPage, ResetPasswordPage } from '../features/auth';
import { BuyerPlaceholder } from '../features/buyer';
import { AddProductPage, EditProductPage, SellerProductsPage } from '../features/catalog';
import { ChangePasswordPage, ProfilePage, SettingsPage } from '../features/profile';
import { RequireStore, SellerPlaceholder, StoreSetupWizard } from '../features/seller';
import { ProtectedRoute } from './ProtectedRoute';

// Base routing skeleton (TRD §12), auth routes match App Flow's literal paths (SCR-A01/A02/A03/A04)
// rather than being nested under /auth. /seller and /admin are RBAC-guarded via ProtectedRoute
// (App Flow's global "401 → Login, 403 → not authorised"); the rest of /buyer stays public — SCR-B01
// is the unauthenticated storefront homepage — but /buyer/profile/* still needs a Buyer session, so
// it gets its own ProtectedRoute group (react-router ranks static segments over the `/buyer/*`
// wildcard, so this takes precedence regardless of array order).
export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/buyer" replace /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/verify-otp', element: <OtpVerifyPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  {
    element: <ProtectedRoute allowedRoles={['BUYER']} />,
    children: [
      { path: '/buyer/profile', element: <ProfilePage /> },
      { path: '/buyer/profile/settings', element: <SettingsPage /> },
      { path: '/buyer/profile/change-password', element: <ChangePasswordPage /> },
    ],
  },
  { path: '/buyer/*', element: <BuyerPlaceholder /> },
  {
    element: <ProtectedRoute allowedRoles={['SELLER']} />,
    children: [
      { path: '/seller/setup', element: <StoreSetupWizard /> },
      {
        element: <RequireStore />,
        children: [
          { path: '/seller', element: <SellerProductsPage /> },
          { path: '/seller/products/new', element: <AddProductPage /> },
          { path: '/seller/products/:productId/edit', element: <EditProductPage /> },
          { path: '/seller/profile', element: <ProfilePage /> },
          { path: '/seller/profile/settings', element: <SettingsPage /> },
          { path: '/seller/profile/change-password', element: <ChangePasswordPage /> },
          { path: '/seller/*', element: <SellerPlaceholder /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={['ADMIN']} />,
    children: [{ path: '/admin/*', element: <AdminPlaceholder /> }],
  },
  { path: '*', element: <EmptyState title="Page not found" description="We couldn't find that." /> },
]);
