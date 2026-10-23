import { useState } from 'react';
import { Alert, Button, Switch } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, Lock, Mail, MessageCircle, Smartphone, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { CRITICAL_NOTIFICATION_CHANNELS, type AccountSettingsDTO, type Language } from '@karobarai/shared';
import { SkeletonLoader } from '../../components';
import { useLanguageStore } from '../../lib/languageStore';
import { PROFILE_QUERY_KEY, getProfile, getSettings, updateSettings } from './profileApi';
import { formatProfileError } from './profileErrors';
import { StoreBrandTab } from './StoreBrandTab';
import { UnderlineTabs } from './UnderlineTabs';
import './profile.css';
import './settings.css';

const SETTINGS_QUERY_KEY = ['profile', 'settings'] as const;

type ToggleField = keyof Pick<AccountSettingsDTO, 'smsEnabled' | 'whatsappEnabled' | 'emailEnabled' | 'inappEnabled'>;

const TOGGLE_FIELDS: Array<{ field: ToggleField; icon: LucideIcon }> = [
  { field: 'inappEnabled', icon: Bell },
  { field: 'smsEnabled', icon: Smartphone },
  { field: 'whatsappEnabled', icon: MessageCircle },
  { field: 'emailEnabled', icon: Mail },
];

const LANGUAGES: Array<{ value: Language; native: string; sample: string }> = [
  { value: 'EN', native: 'English', sample: 'Aa' },
  { value: 'UR', native: 'اردو', sample: 'اب' },
];

type SettingsTab = 'store' | 'notifications';

// smsEnabled/inappEnabled can't actually be disabled server-side (REQ-F-Notif004) — a `false`
// sent for either is silently forced back to `true`. F2-profiles-backend.md is explicit that the
// UI must render these as locked, not just let the toggle snap back after save (which reads as a
// bug). CRITICAL_NOTIFICATION_CHANNELS is the shared source of truth for which those are.
// Every control saves on change (no save button) and says so with a quiet "Saved" tick.
export function SettingsPage() {
  const { t } = useTranslation(['profile', 'common']);
  const queryClient = useQueryClient();

  const { data: settings, isPending, isError: settingsError, refetch } = useQuery({ queryKey: SETTINGS_QUERY_KEY, queryFn: getSettings });
  // Only needed to decide whether this Seller gets a "Store/Brand" tab (Task 5's composition) —
  // Buyers get the notifications/language section on its own.
  const { data: profile, isPending: isProfilePending } = useQuery({ queryKey: PROFILE_QUERY_KEY, queryFn: getProfile });
  const [error, setError] = useState<string | null>(null);
  const [savingField, setSavingField] = useState<ToggleField | null>(null);
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [tab, setTab] = useState<SettingsTab>('store');

  if (settingsError) {
    return (
      <div className="pfPage stPage">
        <Alert type="error" showIcon message={t('profile:errors.GENERIC')}
          action={<Button onClick={() => void refetch()}>{t('common:actions.retry')}</Button>} />
      </div>
    );
  }

  if (isPending || !settings || isProfilePending || !profile) {
    return (
      <div className="pfPage stPage">
        <SkeletonLoader rows={6} />
      </div>
    );
  }

  async function handleToggle(field: ToggleField, checked: boolean) {
    setError(null);
    setSavingField(field);
    try {
      const updated = await updateSettings({ [field]: checked });
      queryClient.setQueryData(SETTINGS_QUERY_KEY, updated);
      setSavedKey(field);
    } catch (err) {
      setError(formatProfileError(t, err));
    } finally {
      setSavingField(null);
    }
  }

  async function handleLanguageChange(language: Language) {
    if (!settings || language === settings.preferredLanguage) return;
    setError(null);
    setSavingLanguage(true);
    try {
      const updated = await updateSettings({ preferredLanguage: language });
      queryClient.setQueryData(SETTINGS_QUERY_KEY, updated);
      // Switch the UI immediately, same as the toggle on Register/Login.
      useLanguageStore.getState().setLanguage(language);
      setSavedKey('language');
    } catch (err) {
      setError(formatProfileError(t, err));
    } finally {
      setSavingLanguage(false);
    }
  }

  const saved = (key: string) => savedKey === key && (
    <span className="stSaved" key={`${key}-saved`} role="status"><Check size={13} aria-hidden="true" />{t('profile:settingsPage.saved')}</span>
  );

  const notificationsSection = (
    <div className="stStack">
      {error && <Alert type="error" message={error} showIcon />}

      <section className="stCard">
        <header className="stCardHead">
          <div>
            <h2 className="stCardTitle">{t('profile:settings.language')}</h2>
            <p className="stCardHint">{t('profile:settingsPage.languageHint')}</p>
          </div>
          {saved('language')}
        </header>
        <div className="stLangs" role="radiogroup" aria-label={t('profile:settings.language')}>
          {LANGUAGES.map((lang) => {
            const selected = settings.preferredLanguage === lang.value;
            return (
              <button key={lang.value} type="button" role="radio" aria-checked={selected} className="stLang"
                disabled={savingLanguage} onClick={() => void handleLanguageChange(lang.value)}>
                <span className="stLangSample" lang={lang.value === 'UR' ? 'ur' : 'en'} aria-hidden="true">{lang.sample}</span>
                <span className="stLangName" lang={lang.value === 'UR' ? 'ur' : 'en'}>{lang.native}</span>
                <span className="stLangCheck" aria-hidden="true"><Check size={13} strokeWidth={3} /></span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="stCard">
        <header className="stCardHead">
          <div>
            <h2 className="stCardTitle">{t('profile:settingsPage.notificationsTitle')}</h2>
            <p className="stCardHint">{t('profile:settingsPage.notificationsHint')}</p>
          </div>
        </header>
        <ul className="stRows">
          {TOGGLE_FIELDS.map(({ field, icon: Icon }) => {
            const locked = (CRITICAL_NOTIFICATION_CHANNELS as readonly string[]).includes(field);
            const id = `setting-${field}`;
            return (
              <li key={field} className="stRow">
                <span className="stRowIcon" aria-hidden="true"><Icon size={18} /></span>
                <div className="stRowText">
                  <label htmlFor={id}>{t(`profile:settings.${field}`)}</label>
                  <span>{t(`profile:settingsPage.channelHint.${field}`)}</span>
                </div>
                {saved(field)}
                {locked && <span className="stLocked"><Lock size={12} aria-hidden="true" />{t('profile:settingsPage.alwaysOn')}</span>}
                <Switch
                  id={id}
                  checked={locked ? true : settings[field]}
                  disabled={locked}
                  loading={savingField === field}
                  aria-describedby={locked ? `${id}-locked` : undefined}
                  onChange={(checked) => void handleToggle(field, checked)}
                />
                {locked && <span id={`${id}-locked`} className="stSr">{t('profile:settings.locked')}</span>}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );

  return (
    <div className="pfPage stPage">
      <header className="stHead">
        <h1 className="stTitle">{t('profile:settings.title')}</h1>
        <p className="stSub">{t(profile.role === 'SELLER' ? 'profile:settingsPage.subtitleSeller' : 'profile:settingsPage.subtitleBuyer')}</p>
      </header>

      {profile.role === 'SELLER' ? (
        <>
          <UnderlineTabs<SettingsTab>
            tabs={[
              { key: 'store', label: t('profile:storeBrand.tabTitle') },
              { key: 'notifications', label: t('profile:storeBrand.notificationsTabTitle') },
            ]}
            active={tab}
            onChange={setTab}
            label={t('profile:settings.title')}
          />
          <div className="pfPanel" key={tab}>
            {tab === 'store' ? <StoreBrandTab profile={profile} /> : notificationsSection}
          </div>
        </>
      ) : (
        notificationsSection
      )}
    </div>
  );
}
