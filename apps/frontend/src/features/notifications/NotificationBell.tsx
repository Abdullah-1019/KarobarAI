import { Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { CountBadge } from '../../components';
import { useUnreadCount } from './useUnreadCount';

// Round 44px icon button (same as the cart and account) with the shared persimmon unread badge,
// matching the messages and AI assistant icons.
export function NotificationBell() {
  const { t } = useTranslation(['notifications', 'common']);
  const navigate = useNavigate();
  const unreadCount = useUnreadCount();
  const label = t('bell.label');

  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={unreadCount > 0 ? t('common:nav.withUnread', { label, count: unreadCount }) : label}
      onClick={() => navigate('/notifications')}
    >
      <Bell size={20} aria-hidden="true" />
      <CountBadge count={unreadCount} />
    </button>
  );
}
