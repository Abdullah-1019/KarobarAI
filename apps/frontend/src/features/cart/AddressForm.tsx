import { useState } from 'react';
import { Alert, Input } from 'antd';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { createAddressSchema, type AddressDTO } from '@karobarai/shared';
import { Button } from '../../components';
import { createAddress } from './cartApi';
import { formatCartError } from './cartErrors';

interface FormValues {
  label: string;
  recipientName: string;
  line1: string;
  line2: string;
  city: string;
  province: string;
  postalCode: string;
  contactPhone: string;
}

interface AddressFormProps {
  onCreated: (address: AddressDTO) => void;
}

// Same react-hook-form + zod pattern as StoreSetupWizard.tsx — createAddressSchema is shared
// with the backend (packages/shared/src/schemas/cart.ts).
export function AddressForm({ onCreated }: AddressFormProps) {
  const { t } = useTranslation(['cart']);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      label: '',
      recipientName: '',
      line1: '',
      line2: '',
      city: '',
      province: '',
      postalCode: '',
      contactPhone: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);

    const payload = {
      label: values.label || null,
      recipientName: values.recipientName,
      line1: values.line1,
      line2: values.line2 || null,
      city: values.city,
      province: values.province,
      postalCode: values.postalCode || null,
      contactPhone: values.contactPhone,
    };

    const parsed = createAddressSchema.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FormValues;
        setError(field, { message: issue.message });
      }
      return;
    }

    setSubmitting(true);
    try {
      const address = await createAddress(parsed.data);
      onCreated(address);
    } catch (err) {
      setSubmitError(formatCartError(t, err));
    } finally {
      setSubmitting(false);
    }
  });

  const fields: { name: keyof FormValues; label: string; required?: boolean; half?: boolean; inputMode?: 'tel'; autoComplete?: string }[] = [
    { name: 'recipientName', label: t('address.recipientName'), required: true, half: true, autoComplete: 'name' },
    { name: 'contactPhone', label: t('address.contactPhone'), required: true, half: true, inputMode: 'tel', autoComplete: 'tel' },
    { name: 'line1', label: t('address.line1'), required: true, autoComplete: 'address-line1' },
    { name: 'line2', label: t('address.line2'), autoComplete: 'address-line2' },
    { name: 'city', label: t('address.city'), required: true, half: true, autoComplete: 'address-level2' },
    { name: 'province', label: t('address.province'), required: true, half: true, autoComplete: 'address-level1' },
    { name: 'postalCode', label: t('address.postalCode'), half: true, autoComplete: 'postal-code' },
    { name: 'label', label: t('address.label'), half: true },
  ];

  return (
    <form onSubmit={onSubmit} className="addr-form" noValidate>
      {submitError && <Alert type="error" message={submitError} showIcon style={{ marginBottom: 'var(--sp-4)', gridColumn: '1 / -1' }} />}

      {fields.map(({ name, label, required, half, inputMode, autoComplete }) => (
        <div key={name} className={`addr-form__field${half ? ' addr-form__field--half' : ''}`}>
          <label htmlFor={`address-${name}`} className="addr-form__label">
            {label}
            {required && <span aria-hidden="true"> *</span>}
          </label>
          <Controller
            name={name}
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                id={`address-${name}`}
                inputMode={inputMode}
                autoComplete={autoComplete}
                aria-required={required || undefined}
                status={errors[name] ? 'error' : undefined}
                aria-invalid={!!errors[name]}
                aria-describedby={errors[name] ? `address-${name}-error` : undefined}
              />
            )}
          />
          {errors[name] && (
            <span id={`address-${name}-error`} className="addr-form__error" role="alert">
              {errors[name]?.message}
            </span>
          )}
        </div>
      ))}

      <div className="addr-form__submit">
        <Button type="submit" size="lg" fullWidth loading={submitting}>
          {t('address.save')}
        </Button>
      </div>
    </form>
  );
}
