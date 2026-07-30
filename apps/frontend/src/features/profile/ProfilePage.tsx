import { Alert, Button, Descriptions, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { SkeletonLoader } from '../../components';
import { roleHomePath } from '../auth/roleHome';
import { AvatarUpload } from './AvatarUpload';
import { PROFILE_QUERY_KEY, getProfile } from './profileApi';
import { formatProfileError } from './profileErrors';

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
      <div style={{ maxWidth: 560, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
        <SkeletonLoader avatar rows={4} />
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
        <Alert type="error" showIcon message={formatProfileError(t, error)} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
      <Typography.Title level={3}>{t('profile:view.title')}</Typography.Title>

      <AvatarUpload avatarUrl={profile.avatarUrl} />

      <Descriptions column={1} style={{ marginTop: 24 }} bordered size="small">
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

      {/* Settings/Change Password only have routes for Buyer/Seller — App Flow has no admin
          self-profile screen (F2-profiles-backend.md), so ADMIN/SUPPORT stop at the view above. */}
      {(profile.role === 'BUYER' || profile.role === 'SELLER') && (
        <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {profile.role === 'SELLER' && (
            <Link to={`${roleHomePath(profile.role)}/profile/edit`}>
              <Button>{t('profile:view.editProfile')}</Button>
            </Link>
          )}
          <Link to={`${roleHomePath(profile.role)}/profile/settings`}>
            <Button>{t('profile:view.settings')}</Button>
          </Link>
          <Link to={`${roleHomePath(profile.role)}/profile/change-password`}>
            <Button>{t('profile:view.changePassword')}</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
