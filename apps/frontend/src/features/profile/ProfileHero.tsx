import { useRef, useState, type ReactNode } from 'react';
import { Spin } from 'antd';
import { ImagePlus, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { ProfileDTO } from '@karobarai/shared';
import { toast } from '../../components';
import { formatProfileError } from './profileErrors';

export interface ProfileStat {
  key: string;
  value: string | null;
  label: string;
}

interface ProfileHeroProps {
  coverUrl?: string | null;
  mediaUrl: string | null;
  mediaShape: 'round' | 'square';
  initial: string;
  name: ReactNode;
  badge?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  stats: ProfileStat[];
  mediaLabel: string;
  onMediaUpload: (file: File) => Promise<ProfileDTO>;
  onCoverUpload?: (file: File) => Promise<ProfileDTO>;
  onUpdated: (profile: ProfileDTO) => void;
}

// Shared profile header (seller store + buyer account): a cover — the store banner, or a Studio
// wash when there is none — with the logo/avatar sitting in a canvas-coloured cut-out over its
// bottom edge. The pencil on the photo and the "Change cover" pill upload straight away through
// the same endpoints Settings uses, so the header is also the quickest way to fix them.
export function ProfileHero({
  coverUrl, mediaUrl, mediaShape, initial, name, badge, meta, actions, stats, mediaLabel,
  onMediaUpload, onCoverUpload, onUpdated,
}: ProfileHeroProps) {
  const { t } = useTranslation(['profile']);
  const mediaInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'media' | 'cover' | null>(null);

  async function upload(kind: 'media' | 'cover', event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    const fn = kind === 'media' ? onMediaUpload : onCoverUpload;
    if (!file || !fn) return;
    setBusy(kind);
    try {
      onUpdated(await fn(file));
      toast.success(t('profile:page.photoSaved'));
    } catch (err) {
      toast.error(formatProfileError(t, err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="pfHero">
      <div className="pfCover" data-empty={!coverUrl || undefined}>
        {coverUrl && <img src={coverUrl} alt="" />}
        {onCoverUpload && (
          <>
            <button type="button" className="pfCoverBtn" onClick={() => coverInput.current?.click()} disabled={busy !== null}>
              {busy === 'cover' ? <Spin size="small" /> : <ImagePlus size={15} aria-hidden="true" />}
              {t('profile:page.changeCover')}
            </button>
            <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => void upload('cover', e)} />
          </>
        )}
      </div>

      <div className="pfIdentity">
        <div className="pfMedia" data-shape={mediaShape}>
          <div className="pfMediaInner">
            {mediaUrl ? <img src={mediaUrl} alt="" /> : <span className="pfInitial" aria-hidden="true">{initial}</span>}
            {busy === 'media' && (
              <span className="pfMediaBusy">
                <Spin />
              </span>
            )}
          </div>
          <button type="button" className="pfMediaEdit" aria-label={mediaLabel} title={mediaLabel}
            onClick={() => mediaInput.current?.click()} disabled={busy !== null}>
            <Pencil size={15} aria-hidden="true" />
          </button>
          <input ref={mediaInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => void upload('media', e)} />
        </div>

        <div className="pfText">
          <h1 className="pfName">
            {name}
            {badge}
          </h1>
          {meta && <div className="pfMeta">{meta}</div>}
          {actions && <div className="pfActions">{actions}</div>}
        </div>

        <dl className="pfStats">
          {stats.map((stat) => (
            <div key={stat.key} className="pfStat">
              <dt>{stat.label}</dt>
              <dd>{stat.value ?? <span className="pfStatPending" aria-hidden="true" />}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
