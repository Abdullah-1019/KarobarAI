import { Badge, Button } from 'antd';
import { Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useUnreadCount } from './useUnreadCount';

// Lucide icon (UIUX §7) replaces the plain 🔔 emoji glyph now that lucide-react is installed.
export function NotificationBell() {
  const { t } = useTranslation(['notifications']);
  const navigate = useNavigate();
  const unreadCount = useUnreadCount();

  return (
    <Badge count={unreadCount} size="small" offset={[-4, 4]}>
      <Button aria-label={t('bell.label')} onClick={() => navigate('/notifications')}>
        <Bell size={20} aria-hidden="true" />
      </Button>
    </Badge>
  );
}
