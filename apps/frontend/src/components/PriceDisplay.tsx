interface PriceDisplayProps {
  amount: number | string;
  size?: 'sm' | 'md' | 'lg';
  /** Subtotal/secondary context — text-secondary instead of text-primary. */
  muted?: boolean;
}

const SIZE_FS: Record<NonNullable<PriceDisplayProps['size']>, string> = {
  sm: 'var(--fs-sm)',
  md: 'var(--fs-lg)',
  lg: 'var(--fs-2xl)',
};

// Single source of truth for money display — was `Rs. {Number(x).toLocaleString()}` repeated
// ad hoc across ProductCard, ProductDetailPage, CartPage, CheckoutPage, CheckoutConfirmationPage
// with inconsistent typography (sometimes a plain div, sometimes Typography.Text/Title). Money
// "always sits high in visual hierarchy" (UIUX §4) and uses tabular figures (§6.1) — both handled
// here once rather than per call site.
export function PriceDisplay({ amount, size = 'md', muted = false }: PriceDisplayProps) {
  return (
    <span
      style={{
        fontSize: SIZE_FS[size],
        fontWeight: size === 'lg' ? 600 : 500,
        color: muted ? 'var(--text-secondary)' : 'var(--text-primary)',
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
      }}
    >
      Rs. {Number(amount).toLocaleString()}
    </span>
  );
}
