import { useRef, useState } from 'react';
import { Alert, Button } from 'antd';
import { Camera, Check, ImagePlus, Loader2, X } from 'lucide-react';
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

const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

// One slot per listing view: the listing photo beside the buyer's matching photo. Order matters
// (the AI compares pair by pair), so only the next empty slot opens the picker and only the last
// photo can be removed. Upload/remove calls are unchanged; minimum count is REQ-F-Return-002.
export function ReturnImageUploader({ returnId, images, references, maxImages, onChange }: ReturnImageUploaderProps) {
  const { t } = useTranslation(['returns']);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const full = images.length >= maxImages;

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
    <div className="rwPhotos">
      <ol className="rwSlots">
        {Array.from({ length: maxImages }, (_, index) => {
          const reference = references[index];
          const image = images[index];
          const isNext = index === images.length;
          return (
            <li key={reference?.id ?? `slot-${index}`} className="rwSlot" data-filled={image ? true : undefined}>
              <span className="rwSlotHead">
                <span className="rwSlotNum">{index + 1}</span>
                {t('wizard.angleNumber', { count: index + 1 })}
              </span>
              <div className="rwSlotPair" data-single={!reference || undefined}>
                {reference && (
                  <figure className="rwSlotRef">
                    <img src={reference.url} alt={t('wizard.referenceAlt', { count: index + 1 })} />
                    <figcaption>{t('buyerFlow.slotListing')}</figcaption>
                  </figure>
                )}
                {image ? (
                  <div className="rwSlotMine">
                    <PrivateEvidenceImage url={image.cdnUrl} fill />
                    <span className="rwSlotTick" aria-hidden="true"><Check size={13} strokeWidth={3} /></span>
                    {index === images.length - 1 && (
                      <button type="button" className="rwSlotRemove" disabled={busy}
                        aria-label={t('buyerFlow.slotRemove', { count: index + 1 })}
                        onClick={() => void handleRemove(image.id)}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ) : (
                  <button type="button" className="rwSlotEmpty" disabled={busy || !isNext}
                    data-next={isNext || undefined} onClick={() => fileInputRef.current?.click()}>
                    {busy && isNext ? <Loader2 size={20} className="rwSpin" aria-hidden="true" /> : <ImagePlus size={20} aria-hidden="true" />}
                    <span>{t('buyerFlow.slotEmpty')}</span>
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="rwPhotoBar">
        <div className="rwMeter" role="status">
          <span className="rwMeterDots" aria-hidden="true">
            {Array.from({ length: maxImages }, (_, index) => (
              <span key={index} data-on={index < images.length || undefined} />
            ))}
          </span>
          <span className="rwMeterText" data-done={full || undefined}>
            {full ? t('buyerFlow.photosReady') : t('wizard.pairedImageCount', { count: images.length, required: maxImages })}
          </span>
        </div>
        <div className="rwPhotoActions">
          <Button shape="round" icon={<ImagePlus size={16} />} loading={busy} disabled={full}
            onClick={() => fileInputRef.current?.click()}>
            {t('buyerFlow.choosePhotos')}
          </Button>
          {isTouch && (
            <Button shape="round" icon={<Camera size={16} />} disabled={busy || full}
              onClick={() => cameraInputRef.current?.click()}>
              {t('buyerFlow.takePhoto')}
            </Button>
          )}
        </div>
      </div>

      <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" hidden onChange={handleFileChange} />
      <input ref={cameraInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={handleFileChange} />
      {error && <Alert type="error" message={error} showIcon className="rwAlert" />}
    </div>
  );
}
