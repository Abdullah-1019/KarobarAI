import { useState } from 'react';
import { Alert, Button, Input, Select } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Lock, MapPin, Store } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';

import { createStoreSchema, type CategoryDTO } from '@karobarai/shared';
import { ApiError } from '../../api';
import { EmptyState, SkeletonLoader } from '../../components';
import { PROFILE_QUERY_KEY, createStore, getProfile } from '../profile/profileApi';
import { CATEGORIES_QUERY_KEY, getCategories } from '../catalog/catalogApi';
import { formatProfileError } from '../profile/profileErrors';

interface FormValues {
  storeName: string;
  storeDescription: string;
  jazzcashAccountNumber: string;
  easypaisaAccountNumber: string;
  storeCategoryId: string | null;
  city: string;
  socialLinks: Record<SocialPlatform, string>;
}

const SOCIAL_PLATFORMS = ['facebook', 'instagram', 'tiktok', 'youtube', 'whatsapp', 'website'] as const;
type SocialPlatform = typeof SOCIAL_PLATFORMS[number];

const STEPS = ['stepStore', 'stepPayments', 'stepSocial'] as const;

// Which step owns a validation issue (by its dotted path). Path-less issues (e.g. the "at least
// one wallet" refinement) belong to the payments step.
function stepForPath(path: string): number {
  if (path.startsWith('socialLinks')) return 2;
  if (path === '' || path.startsWith('jazzcash') || path.startsWith('easypaisa')) return 1;
  return 0;
}

function flattenCategories(categories: CategoryDTO[]): CategoryDTO[] {
  return categories.flatMap((category) => [category, ...flattenCategories(category.children)]);
}

// App Flow SCR-S00 — Store-Setup Wizard. Three client-side steps (store → get paid → social) over
// the one final POST the backend accepts (no draft persistence, F3 Task 2.4): each "Continue"
// validates only that step's fields against the shared schema, and a failed final submit jumps
// back to the first step with an error. A live preview shows the store as buyers will see it.
// Redirects home if onboarding is already complete (avoids a stray 409 for a returning Seller).
export function StoreSetupWizard() {
  const { t, i18n } = useTranslation(['profile', 'common']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isUrdu = i18n.language.startsWith('ur');
  const { data: categories = [] } = useQuery({ queryKey: CATEGORIES_QUERY_KEY, queryFn: getCategories });
  const flatCategories = flattenCategories(categories);
  const categoryOptions = flatCategories.map((category) => ({
    value: category.id,
    label: isUrdu ? category.nameUr : category.nameEn,
  }));

  const { data: profile, isPending, isError, error, refetch } = useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: getProfile,
  });

  const [step, setStep] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [alreadyComplete, setAlreadyComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    clearErrors,
    getValues,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      storeName: '',
      storeDescription: '',
      jazzcashAccountNumber: '',
      easypaisaAccountNumber: '',
      storeCategoryId: null,
      city: '',
      socialLinks: Object.fromEntries(SOCIAL_PLATFORMS.map((platform) => [platform, ''])) as Record<SocialPlatform, string>,
    },
  });

  if (isPending) {
    return (
      <div className="slWizard">
        <SkeletonLoader rows={4} />
      </div>
    );
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

  if (profile.role === 'SELLER' && profile.hasStore) {
    return <Navigate to="/seller" replace />;
  }

  const toPayload = (values: FormValues) => ({
    storeName: values.storeName,
    storeDescription: values.storeDescription.trim() === '' ? null : values.storeDescription,
    storeCategoryId: values.storeCategoryId,
    city: values.city,
    socialLinks: values.socialLinks,
    jazzcashAccountNumber: values.jazzcashAccountNumber.trim() === '' ? undefined : values.jazzcashAccountNumber,
    easypaisaAccountNumber: values.easypaisaAccountNumber.trim() === '' ? undefined : values.easypaisaAccountNumber,
  });

  // Validates the whole payload but reports only the issues owned by `upToStep` or earlier.
  // Returns the first step that still has an error, or null when those steps are clean.
  const validateThrough = (upToStep: number): number | null => {
    clearErrors();
    setSubmitError(null);
    const parsed = createStoreSchema.safeParse(toPayload(getValues()));
    if (parsed.success) return null;
    let firstStep: number | null = null;
    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.');
      const owner = stepForPath(path);
      if (owner > upToStep) continue;
      if (path === '') setSubmitError(issue.message);
      else setError(path as Parameters<typeof setError>[0], { message: issue.message });
      firstStep = firstStep === null ? owner : Math.min(firstStep, owner);
    }
    return firstStep;
  };

  const goNext = () => {
    if (validateThrough(step) === null) setStep((current) => current + 1);
  };

  const onSubmit = handleSubmit(async (values) => {
    const badStep = validateThrough(STEPS.length - 1);
    if (badStep !== null) {
      setStep(badStep);
      return;
    }
    const parsed = createStoreSchema.safeParse(toPayload(values));
    if (!parsed.success) return;

    setSubmitting(true);
    try {
      const updated = await createStore(parsed.data);
      queryClient.setQueryData(PROFILE_QUERY_KEY, updated);
      navigate('/seller');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ONBOARDING_ALREADY_COMPLETE') {
        setAlreadyComplete(true);
      } else {
        setSubmitError(formatProfileError(t, err));
      }
    } finally {
      setSubmitting(false);
    }
  });

  if (alreadyComplete) {
    return (
      <div className="slWizard slWizard--narrow">
        <Alert type="info" showIcon message={t('profile:storeSetup.alreadyComplete')} style={{ marginBottom: 'var(--sp-4)' }} />
        <Button type="primary" block onClick={() => navigate('/seller')}>
          {t('profile:storeSetup.continueToDashboard')}
        </Button>
      </div>
    );
  }

  const previewName = watch('storeName').trim();
  const previewDescription = watch('storeDescription').trim();
  const previewCity = watch('city').trim();
  const previewCategory = flatCategories.find((category) => category.id === watch('storeCategoryId'));
  const isLast = step === STEPS.length - 1;

  const fieldError = (message?: string) => (message ? <p className="slFieldError">{message}</p> : null);

  return (
    <div className="slWizard">
      <div className="slWizardMain">
        <h1 className="slWizardTitle">{t('profile:storeSetup.title')}</h1>
        <p className="slWizardSub">{t('profile:storeSetup.subtitle')}</p>

        <ol className="slSteps" aria-label={t('profile:storeSetup.stepCount', { n: step + 1, total: STEPS.length })}>
          {STEPS.map((key, index) => (
            <li
              key={key}
              className="slStep"
              data-state={index < step ? 'done' : index === step ? 'current' : undefined}
              aria-current={index === step ? 'step' : undefined}
            >
              <span className="slStepDot" aria-hidden="true">
                {index < step ? <Check size={14} strokeWidth={3} /> : index + 1}
              </span>
              <span className="slStepLabel">{t(`profile:storeSetup.${key}`)}</span>
            </li>
          ))}
        </ol>

        {submitError && <Alert type="error" showIcon message={submitError} style={{ marginBottom: 'var(--sp-4)' }} />}

        <form
          // Enter on an early step means "Continue", not "submit the whole store".
          onSubmit={(event) => {
            if (isLast) return onSubmit(event);
            event.preventDefault();
            goNext();
          }}
          noValidate
          className="slWizardForm"
        >
          {step === 0 && (
            <div className="slStepBody" key="store">
              <p className="slStepHelp">{t('profile:storeSetup.stepHintStore')}</p>
              <div className="slField">
                <label htmlFor="store-setup-name">{t('profile:storeSetup.storeNameLabel')}</label>
                <Controller
                  name="storeName"
                  control={control}
                  render={({ field }) => (
                    <Input {...field} id="store-setup-name" size="large" status={errors.storeName ? 'error' : undefined} autoFocus />
                  )}
                />
                {fieldError(errors.storeName?.message)}
              </div>
              <div className="slField">
                <label htmlFor="store-setup-description">{t('profile:storeSetup.storeDescriptionLabel')}</label>
                <Controller
                  name="storeDescription"
                  control={control}
                  render={({ field }) => <Input.TextArea {...field} id="store-setup-description" rows={3} />}
                />
                {fieldError(errors.storeDescription?.message)}
              </div>
              <div className="slFieldRow">
                <div className="slField">
                  <label htmlFor="store-setup-category">{t('profile:storeBrand.category')}</label>
                  <Controller
                    name="storeCategoryId"
                    control={control}
                    render={({ field }) => (
                      <Select
                        id="store-setup-category"
                        size="large"
                        value={field.value ?? undefined}
                        onChange={(value: string | undefined) => field.onChange(value ?? null)}
                        options={categoryOptions}
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        style={{ width: '100%' }}
                      />
                    )}
                  />
                  {fieldError(errors.storeCategoryId?.message)}
                </div>
                <div className="slField">
                  <label htmlFor="store-setup-city">{t('profile:storeBrand.city')}</label>
                  <Controller
                    name="city"
                    control={control}
                    render={({ field }) => <Input {...field} id="store-setup-city" size="large" maxLength={80} />}
                  />
                  {fieldError(errors.city?.message)}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="slStepBody" key="payments">
              <p className="slStepHelp">{t('profile:storeSetup.walletHelp')}</p>
              <div className="slWallets">
                {(['jazzcash', 'easypaisa'] as const).map((wallet) => {
                  const name = `${wallet}AccountNumber` as const;
                  return (
                    <div key={wallet} className="slWallet" data-wallet={wallet}>
                      <label htmlFor={`store-setup-${wallet}`}>{t(`profile:storeSetup.${wallet}Label`)}</label>
                      <Controller
                        name={name}
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            id={`store-setup-${wallet}`}
                            size="large"
                            inputMode="numeric"
                            dir="ltr"
                            placeholder="03001234567"
                            status={errors[name] ? 'error' : undefined}
                          />
                        )}
                      />
                      {fieldError(errors[name]?.message)}
                    </div>
                  );
                })}
              </div>
              <p className="slTrust">
                <Lock size={14} aria-hidden="true" />
                {t('profile:storeSetup.walletTrust')}
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="slStepBody" key="social">
              <p className="slStepHelp">{t('profile:storeSetup.optional')}</p>
              <div className="slSocialGrid">
                {SOCIAL_PLATFORMS.map((platform) => (
                  <div key={platform} className="slField">
                    <label htmlFor={`store-setup-${platform}`}>{t(`profile:storeBrand.${platform}`)}</label>
                    <Controller
                      name={`socialLinks.${platform}`}
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          id={`store-setup-${platform}`}
                          size="large"
                          dir="ltr"
                          maxLength={255}
                          placeholder={platform === 'whatsapp' ? '+923001234567' : 'https://'}
                        />
                      )}
                    />
                    {fieldError(errors.socialLinks?.[platform]?.message)}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="slWizardActions">
            {step > 0 && (
              <Button shape="round" onClick={() => setStep((current) => current - 1)} disabled={submitting}>
                {t('profile:storeSetup.back')}
              </Button>
            )}
            {/* Distinct keys: without them React reuses the "Continue" <button> and flips its type to
                submit mid-click, so the browser submits the form and the last step gets skipped. */}
            {isLast ? (
              <Button key="submit" type="primary" htmlType="submit" shape="round" loading={submitting}>
                {t('profile:storeSetup.submit')}
              </Button>
            ) : (
              <Button key="next" type="primary" shape="round" onClick={goNext}>
                {t('profile:storeSetup.next')}
              </Button>
            )}
          </div>
        </form>
      </div>

      <aside className="slPreview" aria-label={t('profile:storeSetup.previewLabel')}>
        <span className="slPreviewLabel">{t('profile:storeSetup.previewLabel')}</span>
        <div className="slPreviewCard">
          <div className="slPreviewBanner" />
          <span className="slPreviewLogo" aria-hidden="true">
            {previewName ? previewName.slice(0, 1).toUpperCase() : <Store size={22} />}
          </span>
          <span className="slPreviewName" data-empty={!previewName || undefined}>
            {previewName || t('profile:storeSetup.previewName')}
          </span>
          <span className="slPreviewMeta">
            {previewCategory && <span className="slPreviewPill">{isUrdu ? previewCategory.nameUr : previewCategory.nameEn}</span>}
            {previewCity && (
              <span className="slPreviewCity">
                <MapPin size={13} aria-hidden="true" />
                {previewCity}
              </span>
            )}
          </span>
          <p className="slPreviewDesc" data-empty={!previewDescription || undefined}>
            {previewDescription || t('profile:storeSetup.previewDescription')}
          </p>
          <span className="slPreviewTiles" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </div>
      </aside>
    </div>
  );
}
