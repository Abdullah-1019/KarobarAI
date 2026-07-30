import { useRef, useState } from 'react';
import { Alert, Avatar, Button } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { PROFILE_QUERY_KEY, removeAvatar, uploadAvatar } from './profileApi';
import { formatProfileError } from './profileErrors';

interface AvatarUploadProps {
  avatarUrl: string | null;
}

// F2-profiles-backend.md: every avatar call returns a fresh ProfileDTO — write it straight into
// the query cache instead of a second round-trip via GET /me.
export function AvatarUpload({ avatarUrl }: AvatarUploadProps) {
  const { t } = useTranslation(['profile', 'common']);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError(null);
    setBusy(true);
    try {
      const profile = await uploadAvatar(file);
      queryClient.setQueryData(PROFILE_QUERY_KEY, profile);
    } catch (err) {
      setError(formatProfileError(t, err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setError(null);
    setBusy(true);
    try {
      const profile = await removeAvatar();
      queryClient.setQueryData(PROFILE_QUERY_KEY, profile);
    } catch (err) {
      setError(formatProfileError(t, err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <Avatar size={72} src={avatarUrl ?? undefined}>
        {!avatarUrl && t('profile:avatar.initialsFallback')}
      </Avatar>
      <div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" loading={busy} onClick={() => fileInputRef.current?.click()}>
            {t('profile:avatar.upload')}
          </Button>
          {avatarUrl && (
            <Button size="small" danger loading={busy} onClick={handleRemove}>
              {t('profile:avatar.remove')}
            </Button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        {error && (
          <Alert type="error" message={error} showIcon style={{ marginTop: 8, maxWidth: 320 }} />
        )}
      </div>
    </div>
  );
}
