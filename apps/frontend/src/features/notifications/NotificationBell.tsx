import { Badge, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useUnreadCount } from './useUnreadCount';

// No icon package is installed in this app (components/QuantityStepper.tsx's same precedent) —
// a plain glyph instead of pulling in @ant-design/icons for one button.
export function NotificationBell() {
  const { t } = useTranslation(['notifications']);
  const navigate = useNavigate();
  const unreadCount = useUnreadCount();

  return (
    <Badge count={unreadCount} size="small" offset={[-4, 4]}>
      <Button aria-label={t('bell.label')} onClick={() => navigate('/notifications')}>
        🔔
      </Button>
    </Badge>
  );
}
