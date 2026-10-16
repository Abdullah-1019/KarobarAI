import { useRef, useState } from 'react';
import { Alert, Button } from 'antd';
import { useTranslation } from 'react-i18next';

import type { ReturnImageDTO } from '@karobarai/shared';
import { PrivateEvidenceImage } from './PrivateEvidenceImage';
import { removeReturnImage, uploadReturnImages } from './returnsApi';
import { formatReturnsError } from './returnsErrors';

interface ReturnImageUploaderProps {
  returnId: string;
  images: ReturnImageDTO[];
  references: Array<{ id: string; url: string }>;
  maxImages: number;
  onChange: (images: ReturnImageDTO[]) => void;
}

// Mirrors features/catalog/ProductImageManager.tsx's multi-image grid closely, minus reordering
// — position doesn't matter for return evidence photos, only count (>=3, REQ-F-Return-002).
export function ReturnImageUploader({ returnId, images, references, maxImages, onChange }: ReturnImageUploaderProps) {
  const { t } = useTranslation(['returns']);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;
    if (images.length + files.length > maxImages) {
      setError(t('wizard.imageLimit', { count: maxImages }));
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const updated = await uploadReturnImages(returnId, files);
      onChange(updated.images);
    } catch (err) {
      setError(formatReturnsError(t, err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(imageId: string) {
    setError(null);
    setBusy(true);
    try {
      const updated = await removeReturnImage(returnId, imageId);
      onChange(updated.images);
    } catch (err) {
      setError(formatReturnsError(t, err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', marginBottom: 'var(--sp-3)' }}>
        {Array.from({ length: maxImages }, (_, index) => (
          <div key={references[index]?.id ?? `slot-${index}`} style={{ position: 'relative', width: 160 }}>
            <div style={{ marginBottom: 'var(--sp-1)' }}>{t('wizard.angleNumber', { count: index + 1 })}</div>
            {references[index] && <img src={references[index].url} alt={t('wizard.referenceAlt', { count: index + 1 })}
              style={{ width: 100, height: 100, objectFit: 'contain' }} />}
            {images[index] && <PrivateEvidenceImage url={images[index].cdnUrl} size={100} />}
            {images[index] && (
            <Button
              size="small"
              danger
              disabled={busy || index !== images.length - 1}
              onClick={() => handleRemove(images[index]!.id)}
              style={{ display: 'block', margin: 'var(--sp-1) auto 0' }}
            >
              {t('wizard.removeImage')}
            </Button>
            )}
          </div>
        ))}
      </div>

      <Button loading={busy} disabled={images.length >= maxImages} onClick={() => fileInputRef.current?.click()}>
        {t('wizard.uploadImages')}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <div style={{ marginTop: 'var(--sp-1)' }}>
        <span style={{ color: images.length === maxImages ? 'var(--success)' : 'var(--text-secondary)' }}>
          {t('wizard.pairedImageCount', { count: images.length, required: maxImages })}
        </span>
      </div>
      {error && <Alert type="error" message={error} showIcon style={{ marginTop: 'var(--sp-2)', maxWidth: 480 }} />}
    </div>
  );
}
