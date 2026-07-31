import { useState } from 'react';
import { Alert, Segmented, Switch, Tabs, Typography } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { CRITICAL_NOTIFICATION_CHANNELS, type AccountSettingsDTO, type Language } from '@karobarai/shared';
import { SkeletonLoader } from '../../components';
import { useLanguageStore } from '../../lib/languageStore';
import { PROFILE_QUERY_KEY, getProfile, getSettings, updateSettings } from './profileApi';
import { formatProfileError } from './profileErrors';
import { StoreBrandTab } from './StoreBrandTab';

const SETTINGS_QUERY_KEY = ['profile', 'settings'] as const;

type ToggleField = keyof Pick<AccountSettingsDTO, 'smsEnabled' | 'whatsappEnabled' | 'emailEnabled' | 'inappEnabled'>;

const TOGGLE_FIELDS: ToggleField[] = ['smsEnabled', 'whatsappEnabled', 'emailEnabled', 'inappEnabled'];

// smsEnabled/inappEnabled can't actually be disabled server-side (REQ-F-Notif004) — a `false`
// sent for either is silently forced back to `true`. F2-profiles-backend.md is explicit that the
// UI must render these as locked, not just let the toggle snap back after save (which reads as a
// bug). CRITICAL_NOTIFICATION_CHANNELS is the shared source of truth for which those are.
export function SettingsPage() {
  const { t } = useTranslation(['profile', 'common']);
  const queryClient = useQueryClient();

  const { data: settings, isPending } = useQuery({ queryKey: SETTINGS_QUERY_KEY, queryFn: getSettings });
  // Only needed to decide whether this Seller gets a "Store/Brand" tab (Task 5's composition) —
  // Buyers render exactly today's flat layout, unwrapped, zero behavior change.
  const { data: profile, isPending: isProfilePending } = useQuery({ queryKey: PROFILE_QUERY_KEY, queryFn: getProfile });
  const [error, setError] = useState<string | null>(null);
  const [savingField, setSavingField] = useState<ToggleField | null>(null);
  const [savingLanguage, setSavingLanguage] = useState(false);

  if (isPending || !settings || isProfilePending || !profile) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
        <SkeletonLoader rows={4} />
      </div>
    );
  }

  async function handleToggle(field: ToggleField, checked: boolean) {
    setError(null);
    setSavingField(field);
    try {
      const updated = await updateSettings({ [field]: checked });
      queryClient.setQueryData(SETTINGS_QUERY_KEY, updated);
    } catch (err) {
      setError(formatProfileError(t, err));
    } finally {
      setSavingField(null);
    }
  }

  async function handleLanguageChange(language: Language) {
    setError(null);
    setSavingLanguage(true);
    try {
      const updated = await updateSettings({ preferredLanguage: language });
      queryClient.setQueryData(SETTINGS_QUERY_KEY, updated);
      // Switch the UI immediately, same as the toggle on Register/Login.
      useLanguageStore.getState().setLanguage(language);
    } catch (err) {
      setError(formatProfileError(t, err));
    } finally {
      setSavingLanguage(false);
    }
  }

  const notificationsSection = (
    <>
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 0',
          borderBottom: '1px solid var(--border-color, #f0f0f0)',
        }}
      >
        <Typography.Text>{t('profile:settings.language')}</Typography.Text>
        <Segmented
          disabled={savingLanguage}
          value={settings.preferredLanguage}
          onChange={(value) => handleLanguageChange(value as Language)}
          options={[
            { label: 'EN', value: 'EN' },
            { label: 'اردو', value: 'UR' },
          ]}
        />
      </div>

      {TOGGLE_FIELDS.map((field) => {
        const locked = (CRITICAL_NOTIFICATION_CHANNELS as readonly string[]).includes(field);
        return (
          <div
            key={field}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 0',
              borderBottom: '1px solid var(--border-color, #f0f0f0)',
            }}
          >
            <div>
              <Typography.Text>{t(`profile:settings.${field}`)}</Typography.Text>
              {locked && (
                <Typography.Text type="secondary" style={{ display: 'block', fontSize: 'var(--fs-xs)' }}>
                  {t('profile:settings.locked')}
                </Typography.Text>
              )}
            </div>
            <Switch
              checked={locked ? true : settings[field]}
              disabled={locked}
              loading={savingField === field}
              onChange={(checked) => handleToggle(field, checked)}
            />
          </div>
        );
      })}
    </>
  );

  return (
    <div style={{ maxWidth: profile.role === 'SELLER' ? 720 : 480, margin: '0 auto', padding: 'var(--sp-6, 24px)' }}>
      <Typography.Title level={3}>{t('profile:settings.title')}</Typography.Title>

      {profile.role === 'SELLER' ? (
        <Tabs
          items={[
            { key: 'store', label: t('profile:storeBrand.tabTitle'), children: <StoreBrandTab profile={profile} /> },
            { key: 'notifications', label: t('profile:storeBrand.notificationsTabTitle'), children: notificationsSection },
          ]}
        />
      ) : (
        notificationsSection
      )}
    </div>
  );
}
