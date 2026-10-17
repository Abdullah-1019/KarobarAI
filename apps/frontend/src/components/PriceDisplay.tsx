interface PriceDisplayProps {
  amount: number | string;
  size?: 'sm' | 'md' | 'lg';
  /** Subtotal/secondary context — text-secondary instead of text-primary. */
  muted?: boolean;
  /** `brand` paints the figure in the brand colour (rare: persimmon is reserved for the CTA). */
  tone?: 'default' | 'brand';
  /** Heavier weight — the "money sits high in visual hierarchy" case on product cards. */
  strong?: boolean;
}

const SIZE_FS: Record<NonNullable<PriceDisplayProps['size']>, string> = {
  sm: 'var(--fs-sm)',
  md: 'var(--fs-lg)',
  lg: 'var(--fs-2xl)',
};

// Fixed to en-PK so digits are always Latin (Western Arabic) regardless of the browser's own
// locale — the whole product catalogue is priced in PKR. `toLocaleString()` with no locale argument
// follows the client locale, which is only coincidentally correct.
const PKR_FORMATTER = new Intl.NumberFormat('en-PK');

// Single source of truth for money display — was `Rs. {Number(x).toLocaleString()}` repeated
// ad hoc across ProductCard, ProductDetailPage, CartPage, CheckoutPage, CheckoutConfirmationPage
// with inconsistent typography (sometimes a plain div, sometimes Typography.Text/Title). Money
// "always sits high in visual hierarchy" (UIUX §4) and uses tabular figures (§6.1) — both handled
// here once rather than per call site.
export function PriceDisplay({ amount, size = 'md', muted = false, tone = 'default', strong = false }: PriceDisplayProps) {
  return (
    <span
      style={{
        // Prices are set in the display face (DESIGN-CONSULT §3: Outfit 600, tabular). A context
        // can resize them through --price-fs without a new size step (the product card uses 20px).
        fontFamily: 'var(--font-heading)',
        fontSize: `var(--price-fs, ${SIZE_FS[size]})`,
        fontWeight: strong || size === 'lg' ? 600 : 500,
        color: tone === 'brand' ? 'var(--brand-primary)' : muted ? 'var(--text-secondary)' : 'var(--text-primary)',
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
        letterSpacing: '-0.01em',
      }}
    >
      Rs. {PKR_FORMATTER.format(Number(amount))}
    </span>
  );
}

export const PriceTag = PriceDisplay;
export type { PriceDisplayProps as PriceTagProps };
