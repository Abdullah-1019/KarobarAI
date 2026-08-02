import { useState } from 'react';
import { Alert, Button, Input, Typography } from 'antd';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { createAddressSchema, type AddressDTO } from '@karobarai/shared';
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

  const fields: { name: keyof FormValues; label: string; required?: boolean }[] = [
    { name: 'recipientName', label: t('address.recipientName'), required: true },
    { name: 'label', label: t('address.label') },
    { name: 'line1', label: t('address.line1'), required: true },
    { name: 'line2', label: t('address.line2') },
    { name: 'city', label: t('address.city'), required: true },
    { name: 'province', label: t('address.province'), required: true },
    { name: 'postalCode', label: t('address.postalCode') },
    { name: 'contactPhone', label: t('address.contactPhone'), required: true },
  ];

  return (
    <form onSubmit={onSubmit}>
      {submitError && <Alert type="error" message={submitError} showIcon style={{ marginBottom: 16 }} />}

      {fields.map(({ name, label }) => (
        <div key={name} style={{ marginBottom: 12 }}>
          <label>{label}</label>
          <Controller name={name} control={control} render={({ field }) => <Input {...field} />} />
          {errors[name] && <Typography.Text type="danger">{errors[name]?.message}</Typography.Text>}
        </div>
      ))}

      <Button type="primary" htmlType="submit" block loading={submitting}>
        {t('address.save')}
      </Button>
    </form>
  );
}
