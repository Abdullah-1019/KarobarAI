/** "M / Black" — the human label for a size/colour variant (also snapshotted on order items). */
export function variantLabel(variant: { size: string | null; color: string | null }): string {
  return [variant.size, variant.color].filter(Boolean).join(' / ');
}
