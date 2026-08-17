import { useState, type CSSProperties } from 'react';
import { ImageOff } from 'lucide-react';

interface ProductThumbnailProps {
  src: string | null;
  alt?: string;
  /** Fixed square size in px — ignored when `fill` is set. */
  size?: number;
  /** 100% of the parent width, 1:1 aspect ratio (UIUX §13: "product card image 1:1"). */
  fill?: boolean;
  radius?: 'sm' | 'md';
  /** Merged on top of the base box styles — e.g. a primary-image outline. */
  style?: CSSProperties;
}

// Single source of truth for "product image, or a warm-neutral placeholder if there isn't one" —
// previously hand-rolled separately in ProductCard, CartPage (x2: buyer + guest rows), and
// ProductDetailPage, each with a slightly different radius (0, raw 4px) and no enforced aspect
// ratio. `fill` covers the 1:1 card-cover case; a fixed `size` covers list rows (cart items).
//
// The ImageOff icon renders immediately underneath the <img> rather than only after a load
// failure — an in-flight request (or one still queued behind the browser's per-host connection
// limit on a page with 20+ thumbnails at once) previously left the box completely blank until
// onError fired, which read as a rendering glitch rather than a loading state, and was especially
// visible in dark mode where --bg-sunken is close to true black. The image fades in on top (only
// once it actually loads) and covers the icon; on failure it simply never appears, leaving the
// icon as the final state — one code path handles "no photo," "loading," and "failed" instead of
// three different visual outcomes.
export function ProductThumbnail({ src, alt = '', size = 64, fill = false, radius = 'sm', style }: ProductThumbnailProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const borderRadius = radius === 'md' ? 'var(--radius-md)' : 'var(--radius-sm)';
  const box: CSSProperties = fill
    ? { width: '100%', aspectRatio: '1 / 1', borderRadius, overflow: 'hidden', background: 'var(--bg-sunken)', ...style }
    : { width: size, height: size, flexShrink: 0, borderRadius, overflow: 'hidden', background: 'var(--bg-sunken)', ...style };

  const iconSize = fill ? 28 : Math.max(14, Math.round(size * 0.3));

  return (
    <div style={{ ...box, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <ImageOff size={iconSize} strokeWidth={1.5} color="var(--text-disabled)" aria-hidden="true" />
      {src && !failed && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: loaded ? 1 : 0,
            transition: 'opacity var(--dur-base) var(--ease)',
          }}
        />
      )}
    </div>
  );
}
