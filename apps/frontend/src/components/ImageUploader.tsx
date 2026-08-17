import { useRef, useState } from 'react';
import { Alert, Avatar, Button } from 'antd';

interface ImageUploaderProps<T> {
  value: string | null;
  shape?: 'circle' | 'rect';
  uploadLabel: string;
  removeLabel: string;
  onUpload: (file: File) => Promise<T>;
  onRemove: () => Promise<T>;
  onSuccess: (result: T) => void;
  formatError: (err: unknown) => string;
}

// Generalized version of features/profile/AvatarUpload.tsx's upload/remove pattern — built for
// Feature 3's logo + banner uploaders (two new near-duplicates being written at once is exactly
// where generalizing pays off; AvatarUpload itself is left as-is, working and already tested).
// Generic over T (the DTO returned by upload/remove) so callers get real typing instead of
// `unknown` at the queryClient.setQueryData call site.
export function ImageUploader<T>({
  value,
  shape = 'rect',
  uploadLabel,
  removeLabel,
  onUpload,
  onRemove,
  onSuccess,
  formatError,
}: ImageUploaderProps<T>) {
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
      const result = await onUpload(file);
      onSuccess(result);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setError(null);
    setBusy(true);
    try {
      const result = await onRemove();
      onSuccess(result);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  // Not ProductThumbnail: that component is 1:1-square-only by design (UIUX §13's product-card
  // spec) — this uploader's rect shape is a wide banner aspect (160x72), which ProductThumbnail
  // can't represent, so it keeps its own box rather than being forced into the wrong shape.
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
      {shape === 'circle' ? (
        <Avatar size={72} src={value ?? undefined} shape="circle" />
      ) : value ? (
        <img
          src={value}
          alt=""
          style={{ width: 160, height: 72, objectFit: 'cover', borderRadius: 'var(--radius-sm)', background: 'var(--bg-sunken)' }}
        />
      ) : (
        <div
          style={{
            width: 160,
            height: 72,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-sunken)',
          }}
        />
      )}
      <div>
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          <Button size="small" loading={busy} onClick={() => fileInputRef.current?.click()}>
            {uploadLabel}
          </Button>
          {value && (
            <Button size="small" danger loading={busy} onClick={handleRemove}>
              {removeLabel}
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
          <Alert type="error" message={error} showIcon style={{ marginTop: 'var(--sp-2)', maxWidth: 320 }} />
        )}
      </div>
    </div>
  );
}
