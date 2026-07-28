import { Navigate, createBrowserRouter } from 'react-router-dom';

import { EmptyState } from '../components';
import { AdminPlaceholder } from '../features/admin';
import { AuthPlaceholder } from '../features/auth';
import { BuyerPlaceholder } from '../features/buyer';
import { SellerPlaceholder } from '../features/seller';

// Base routing skeleton (TRD §12) — one area per feature folder, no protected routes yet.
// Route guards (role-based redirect per App Flow §6.1) arrive with Feature 1.
export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/buyer" replace /> },
  { path: '/auth/*', element: <AuthPlaceholder /> },
  { path: '/buyer/*', element: <BuyerPlaceholder /> },
  { path: '/seller/*', element: <SellerPlaceholder /> },
  { path: '/admin/*', element: <AdminPlaceholder /> },
  { path: '*', element: <EmptyState title="Page not found" description="We couldn't find that." /> },
]);
