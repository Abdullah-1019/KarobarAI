import { useRef, useState } from 'react';
import { Alert, Button } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import type { ProductImageDTO } from '@karobarai/shared';
import { productQueryKey, removeProductImage, reorderProductImages, uploadProductImages } from './catalogApi';
import { formatCatalogError } from './catalogErrors';

interface ProductImageManagerProps {
  productId: string;
  images: ProductImageDTO[];
}

// F4-catalog-backend.md: first upload = position 0 = primary; removing any image re-sequences
// the rest automatically (no separate "set primary" step needed). No drag-and-drop library is in
// this project yet, so reordering uses move-left/move-right instead of introducing a new
// dependency for one screen — swaps two adjacent IDs and sends the full permutation, matching the
// backend's "must be a complete permutation" contract.
export function ProductImageManager({ productId, images }: ProductImageManagerProps) {
  const { t } = useTranslation(['catalog']);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sorted = [...images].sort((a, b) => a.position - b.position);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    setError(null);
    setBusy(true);
    try {
      const updated = await uploadProductImages(productId, files);
      queryClient.setQueryData(productQueryKey(productId), updated);
    } catch (err) {
      setError(formatCatalogError(t, err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(imageId: string) {
    setError(null);
    setBusy(true);
    try {
      const updated = await removeProductImage(productId, imageId);
      queryClient.setQueryData(productQueryKey(productId), updated);
    } catch (err) {
      setError(formatCatalogError(t, err));
    } finally {
      setBusy(false);
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sorted.length) return;

    const reordered = [...sorted];
    const a = reordered[index]!;
    const b = reordered[target]!;
    reordered[index] = b;
    reordered[target] = a;

    setError(null);
    setBusy(true);
    try {
      const updated = await reorderProductImages(productId, reordered.map((img) => img.id));
      queryClient.setQueryData(productQueryKey(productId), updated);
    } catch (err) {
      setError(formatCatalogError(t, err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
        {sorted.map((img, index) => (
          <div key={img.id} style={{ position: 'relative' }}>
            <img
              src={img.url}
              alt=""
              style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 4, border: index === 0 ? '2px solid var(--color-primary, #2f8f5b)' : undefined }}
            />
            {index === 0 && (
              <div style={{ position: 'absolute', top: 2, left: 2, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 10, padding: '1px 4px', borderRadius: 2 }}>
                {t('catalog:editProduct.primaryBadge')}
              </div>
            )}
            <div style={{ display: 'flex', gap: 4, marginTop: 4, justifyContent: 'center' }}>
              <Button size="small" disabled={busy || index === 0} onClick={() => handleMove(index, -1)}>
                ←
              </Button>
              <Button size="small" danger disabled={busy} onClick={() => handleRemove(img.id)}>
                {t('catalog:editProduct.removeImage')}
              </Button>
              <Button size="small" disabled={busy || index === sorted.length - 1} onClick={() => handleMove(index, 1)}>
                →
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button loading={busy} onClick={() => fileInputRef.current?.click()}>
        {t('catalog:editProduct.uploadImages')}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      {error && <Alert type="error" message={error} showIcon style={{ marginTop: 8, maxWidth: 480 }} />}
    </div>
  );
}
