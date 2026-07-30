import type { UserRole } from '@karobarai/shared';
import { Navigate, Outlet } from 'react-router-dom';

import { EmptyState, SkeletonLoader } from '../components';
import { useAuthStore } from '../lib/authStore';

interface ProtectedRouteProps {
  allowedRoles: UserRole[];
}

// App Flow's global UI states: "401 → redirect to Login; 403 → not authorised page." Held open
// while status is 'restoring' (AppProviders' boot-time refresh()+me() call) so a hard refresh on
// a protected route doesn't bounce a still-logged-in user to /login before the check even runs.
export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);

  if (status === 'restoring') {
    return <SkeletonLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <EmptyState title="Not authorised" description="You don't have access to this page." />;
  }

  return <Outlet />;
}
