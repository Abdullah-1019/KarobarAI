import { useRef, useState } from 'react';
import { Alert, Button } from 'antd';
import { useTranslation } from 'react-i18next';

import type { ReturnImageDTO } from '@karobarai/shared';
import { removeReturnImage, uploadReturnImages } from './returnsApi';
import { formatReturnsError } from './returnsErrors';

interface ReturnImageUploaderProps {
  returnId: string;
  images: ReturnImageDTO[];
  onChange: (images: ReturnImageDTO[]) => void;
}

// Mirrors features/catalog/ProductImageManager.tsx's multi-image grid closely, minus reordering
// — position doesn't matter for return evidence photos, only count (>=3, REQ-F-Return-002).
export function ReturnImageUploader({ returnId, images, onChange }: ReturnImageUploaderProps) {
  const { t } = useTranslation(['returns']);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
        {images.map((img) => (
          <div key={img.id} style={{ position: 'relative' }}>
            <img
              src={img.cdnUrl}
              alt=""
              style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 4 }}
            />
            <Button
              size="small"
              danger
              disabled={busy}
              onClick={() => handleRemove(img.id)}
              style={{ display: 'block', margin: '4px auto 0' }}
            >
              {t('wizard.removeImage')}
            </Button>
          </div>
        ))}
      </div>

      <Button loading={busy} onClick={() => fileInputRef.current?.click()}>
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
      <div style={{ marginTop: 4 }}>
        <span style={{ color: images.length >= 3 ? 'var(--color-success, #389e0d)' : 'rgba(0,0,0,0.45)' }}>
          {t('wizard.imageCount', { count: images.length })}
        </span>
      </div>
      {error && <Alert type="error" message={error} showIcon style={{ marginTop: 8, maxWidth: 480 }} />}
    </div>
  );
}
