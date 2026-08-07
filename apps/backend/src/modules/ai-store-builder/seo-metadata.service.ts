import type { AiSeoPreviewDTO } from '@karobarai/shared';

// Task 5.1/5.2 — Doc 5 §4.6 has no meta_title/meta_description/seo_slug columns; this is a
// deliberately ephemeral, non-persisted derivation from already-generated fields (see the
// handoff doc's Documentation Gap #1 discussion). Never written to products — tags (already
// produced by Task 4) are the actual persisted SEO mechanism.
const META_DESCRIPTION_MAX_LENGTH = 155; // a general SEO convention, not sourced from any
// project document — flagged as Assumption #2 in the module doc itself.

function truncateAtWordBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  const cut = lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
  return `${cut.trimEnd()}…`;
}

export function derivePreview(titleEn: string, descriptionEn: string): AiSeoPreviewDTO {
  return {
    metaTitle: titleEn,
    metaDescription: truncateAtWordBoundary(descriptionEn, META_DESCRIPTION_MAX_LENGTH),
  };
}
