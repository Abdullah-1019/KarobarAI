import { Navigate, createBrowserRouter } from 'react-router-dom';

import { EmptyState } from '../components';
import { AdminPlaceholder } from '../features/admin';
import { LoginPage, OtpVerifyPage, RegisterPage } from '../features/auth';
import { BuyerPlaceholder } from '../features/buyer';
import { SellerPlaceholder } from '../features/seller';

// Base routing skeleton (TRD §12), auth routes match App Flow's literal paths (SCR-A01/A02/A03)
// rather than being nested under /auth. No protected routes yet — those arrive with RBAC
// (Day 4 per docs/DailyPlan.md), once there's a logged-in screen to actually guard.
export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/buyer" replace /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/verify-otp', element: <OtpVerifyPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/buyer/*', element: <BuyerPlaceholder /> },
  { path: '/seller/*', element: <SellerPlaceholder /> },
  { path: '/admin/*', element: <AdminPlaceholder /> },
  { path: '*', element: <EmptyState title="Page not found" description="We couldn't find that." /> },
]);
