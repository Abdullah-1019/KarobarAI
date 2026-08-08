import { createBrowserRouter } from 'react-router-dom';

import { EmptyState } from '../components';
import { AdminPlaceholder } from '../features/admin';
import { ForgotPasswordPage, LoginPage, OtpVerifyPage, RegisterPage, ResetPasswordPage } from '../features/auth';
import { AddProductPage, EditProductPage, SellerProductsPage } from '../features/catalog';
import { CartPage, CheckoutConfirmationPage, CheckoutPage } from '../features/cart';
import { CategoryPage, HomePage, ProductDetailPage, SearchPage, StorefrontLayout } from '../features/marketplace';
import { NotificationCenterPage } from '../features/notifications';
import { BuyerOrderDetailPage, BuyerOrdersPage, SellerOrderDetailPage, SellerOrdersPage } from '../features/orders';
import { ChangePasswordPage, ProfilePage, SettingsPage } from '../features/profile';
import { RequireStore, SellerLayout, SellerPlaceholder, StoreSetupWizard } from '../features/seller';
import { BuyerTrackingPage, PublicTrackingPage, SellerTrackingPage } from '../features/tracking';
import { ProtectedRoute } from './ProtectedRoute';

// Base routing skeleton (TRD §12), auth routes match App Flow's literal paths (SCR-A01/A02/A03/A04)
// rather than being nested under /auth. Home moved from the old /buyer placeholder to '/' once
// Feature 5 gave it a real screen (SCR-B01) — StorefrontLayout wraps every storefront-facing
// route (home, search, product detail, cart, and the buyer-protected checkout/orders group).
// /buyer/profile/* keeps its original path, just re-nested under the layout so it gets the
// header too; it needs its own ProtectedRoute group since the rest of the storefront stays public
// for guests. /seller and /admin are RBAC-guarded via ProtectedRoute (App Flow's global
// "401 → Login, 403 → not authorised").
export const router = createBrowserRouter([
  { path: '/register', element: <RegisterPage /> },
  { path: '/verify-otp', element: <OtpVerifyPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  // SCR-B09 — public, login-free tracking (REQ-F-Track005). Top-level like the auth routes above:
  // no StorefrontLayout header/chrome, no account actions.
  { path: '/t/:publicToken', element: <PublicTrackingPage /> },
  {
    element: <StorefrontLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/search', element: <SearchPage /> },
      { path: '/category/:slug', element: <CategoryPage /> },
      { path: '/product/:id', element: <ProductDetailPage /> },
      { path: '/cart', element: <CartPage /> },
      {
        element: <ProtectedRoute allowedRoles={['BUYER']} />,
        children: [
          { path: '/checkout', element: <CheckoutPage /> },
          { path: '/checkout/confirmation', element: <CheckoutConfirmationPage /> },
          { path: '/orders', element: <BuyerOrdersPage /> },
          { path: '/orders/:id', element: <BuyerOrderDetailPage /> },
          { path: '/orders/:id/track', element: <BuyerTrackingPage /> },
          { path: '/buyer/profile', element: <ProfilePage /> },
          { path: '/buyer/profile/settings', element: <SettingsPage /> },
          { path: '/buyer/profile/change-password', element: <ChangePasswordPage /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={['SELLER']} />,
    children: [
      // SellerLayout wraps the whole branch (including /seller/setup, so a brand-new Seller
      // still gets consistent chrome) — previously nothing here rendered any header/nav at all.
      {
        element: <SellerLayout />,
        children: [
          { path: '/seller/setup', element: <StoreSetupWizard /> },
          {
            element: <RequireStore />,
            children: [
              { path: '/seller', element: <SellerProductsPage /> },
              { path: '/seller/products/new', element: <AddProductPage /> },
              { path: '/seller/products/:productId/edit', element: <EditProductPage /> },
              { path: '/seller/orders', element: <SellerOrdersPage /> },
              { path: '/seller/orders/:id', element: <SellerOrderDetailPage /> },
              { path: '/seller/orders/:id/track', element: <SellerTrackingPage /> },
              { path: '/seller/profile', element: <ProfilePage /> },
              { path: '/seller/profile/settings', element: <SettingsPage /> },
              { path: '/seller/profile/change-password', element: <ChangePasswordPage /> },
              { path: '/seller/*', element: <SellerPlaceholder /> },
            ],
          },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={['ADMIN']} />,
    children: [{ path: '/admin/*', element: <AdminPlaceholder /> }],
  },
  // Feature 9 — personal to any authenticated role, not nested under either layout (same
  // bare-page convention as features/tracking's detail-style pages).
  {
    element: <ProtectedRoute allowedRoles={['BUYER', 'SELLER', 'ADMIN']} />,
    children: [{ path: '/notifications', element: <NotificationCenterPage /> }],
  },
  { path: '*', element: <EmptyState title="Page not found" description="We couldn't find that." /> },
]);
