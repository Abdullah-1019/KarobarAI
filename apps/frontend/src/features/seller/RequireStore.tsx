import { Navigate, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { EmptyState, SkeletonLoader } from '../../components';
import { PROFILE_QUERY_KEY, getProfile } from '../profile/profileApi';
import { formatProfileError } from '../profile/profileErrors';

// Feature 3's route-level enforcement of "hasStore" (F3-store-management-backend.md /
// docs/modules/3_ Store Management.md Task 2.3) — nested inside the SELLER ProtectedRoute group,
// wrapping every /seller/* route except /seller/setup itself. Reuses profileApi/profileErrors
// from features/profile/ rather than a parallel store module, mirroring the backend's own
// decision not to build one.
export function RequireStore() {
  const { t } = useTranslation(['profile', 'common']);
  const { data: profile, isPending, isError, error, refetch } = useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: getProfile,
  });

  if (isPending) {
    return <SkeletonLoader />;
  }

  if (isError) {
    return (
      <EmptyState
        title={t('common:state.error')}
        description={formatProfileError(t, error)}
        actionLabel={t('common:actions.retry')}
        onAction={() => refetch()}
      />
    );
  }

  if (profile.role === 'SELLER' && !profile.hasStore) {
    return <Navigate to="/seller/setup" replace />;
  }

  return <Outlet />;
}
