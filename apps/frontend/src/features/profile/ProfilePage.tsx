import { Alert, Button, Card, Descriptions, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { SkeletonLoader } from '../../components';
import { AvatarUpload } from './AvatarUpload';
import { PROFILE_QUERY_KEY, getProfile } from './profileApi';
import { formatProfileError } from './profileErrors';

// NOT roleHomePath() — that returns the role's storefront/dashboard home ('/' for Buyer), not
// the '/buyer'|'/seller' prefix these nested profile routes actually live under (router.tsx).
// Reusing roleHomePath() here previously built `${'/'}/profile/settings` = '//profile/settings'
// for Buyer — a protocol-relative URL the browser resolves as host "profile", causing
// DNS_PROBE_FINISHED_NXDOMAIN on click (it only "worked" for Seller by coincidence, since
// roleHomePath('SELLER') happens to equal '/seller').
function profileBasePath(role: 'BUYER' | 'SELLER'): string {
  return role === 'SELLER' ? '/seller' : '/buyer';
}

// App Flow SCR-B12 (Buyer)/SCR-S10 (Seller) profile views. GET /me discriminates on `role` —
// F2-profiles-backend.md: one contract, three shapes, no per-role endpoint.
export function ProfilePage() {
  const { t } = useTranslation(['profile', 'common']);
  const { data: profile, isPending, isError, error } = useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: getProfile,
  });

  if (isPending) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <SkeletonLoader avatar rows={4} />
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <Alert type="error" showIcon message={formatProfileError(t, error)} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <Typography.Title level={3} style={{ marginBottom: 'var(--sp-5)' }}>
        {t('profile:view.title')}
      </Typography.Title>

      <Card>
        <AvatarUpload avatarUrl={profile.avatarUrl} />

        <Descriptions column={1} style={{ marginTop: 'var(--sp-6)' }} bordered size="small">
          <Descriptions.Item label={t('profile:view.role')}>{profile.role}</Descriptions.Item>
          <Descriptions.Item label={t('profile:view.status')}>{profile.status}</Descriptions.Item>
          <Descriptions.Item label={t('profile:view.language')}>{profile.preferredLanguage}</Descriptions.Item>
          {profile.role === 'SELLER' && (
            <>
              <Descriptions.Item label={t('profile:view.storeName')}>{profile.storeName}</Descriptions.Item>
              <Descriptions.Item label={t('profile:view.storeDescription')}>
                {profile.storeDescription ?? t('profile:view.notSet')}
              </Descriptions.Item>
            </>
          )}
        </Descriptions>
      </Card>

      {/* Settings/Change Password only have routes for Buyer/Seller — App Flow has no admin
          self-profile screen (F2-profiles-backend.md), so ADMIN/SUPPORT stop at the view above. */}
      {(profile.role === 'BUYER' || profile.role === 'SELLER') && (
        <div style={{ marginTop: 'var(--sp-6)', display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
          <Link to={`${profileBasePath(profile.role)}/profile/settings`}>
            <Button>{t('profile:view.settings')}</Button>
          </Link>
          <Link to={`${profileBasePath(profile.role)}/profile/change-password`}>
            <Button>{t('profile:view.changePassword')}</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
