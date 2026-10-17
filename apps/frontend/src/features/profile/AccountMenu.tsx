import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { useAuthStore } from '../../lib/authStore';
import { PROFILE_QUERY_KEY, getProfile } from './profileApi';

interface AccountMenuProps {
  /** Menu shown on click for a signed-in user (role-specific links + logout). */
  items: MenuProps['items'];
}

// The account avatar shared by every header (Buyer storefront, Seller, Admin). Shows the user's
// real photo (or a Seller's store logo) when one exists, otherwise a person glyph on sand — never
// invented initials, since the profile has no name field. Reads the same cached profile query the
// Profile screens use, so an avatar upload updates the header immediately.
export function AccountMenu({ items }: AccountMenuProps) {
  const { t } = useTranslation('common');
  const user = useAuthStore((s) => s.user);
  const [imageFailed, setImageFailed] = useState(false);

  const { data: profile } = useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: getProfile,
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const photo = profile?.avatarUrl ?? (profile?.role === 'SELLER' ? profile.logoUrl : null);
  const showPhoto = !!photo && !imageFailed;

  return (
    <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight">
      <button type="button" className="account-avatar" aria-label={t('nav.account')}>
        {showPhoto ? (
          <img src={photo} alt="" className="account-avatar__img" onError={() => setImageFailed(true)} />
        ) : (
          <User size={20} aria-hidden="true" />
        )}
      </button>
    </Dropdown>
  );
}

/** Signed-out counterpart: the same round glyph, linking to login (label visible on desktop). */
export function GuestAccountLink({ label }: { label: string }) {
  return (
    <Link to="/login" className="account-guest" aria-label={label}>
      <span className="account-avatar" aria-hidden="true">
        <User size={20} />
      </span>
      <span className="account-guest__label">{label}</span>
    </Link>
  );
}
