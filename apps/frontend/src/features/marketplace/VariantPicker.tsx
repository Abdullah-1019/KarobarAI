import type { ProductVariantDTO } from '@karobarai/shared';
import { useTranslation } from 'react-i18next';

import './VariantPicker.css';

interface VariantPickerProps {
  variants: ProductVariantDTO[];
  value: string | null;
  onChange: (variantId: string) => void;
  /** Shown after an add was tried without a choice. */
  showRequired?: boolean;
}

// Feature 23 — the product page's size/colour choice: one stone chip per option, the chosen one in
// ink, sold-out options struck through and disabled. Variants share the product price, so only the
// label and its own stock matter here.
export function VariantPicker({ variants, value, onChange, showRequired = false }: VariantPickerProps) {
  const { t } = useTranslation('marketplace');
  return (
    <fieldset className="pdp-variants" aria-describedby={showRequired ? 'pdp-variants-required' : undefined}>
      <legend className="pdp-variants__label">{t('pdp.chooseVariant')}</legend>
      <div className="pdp-variants__chips">
        {variants.map((variant) => {
          const soldOut = variant.stock <= 0;
          return (
            <button
              key={variant.id}
              type="button"
              className="pdp-variant"
              aria-pressed={value === variant.id}
              disabled={soldOut}
              title={soldOut ? t('product.outOfStock') : undefined}
              onClick={() => onChange(variant.id)}
            >
              <span dir="auto">{variant.label}</span>
              {soldOut && <span className="sr-only">{t('product.outOfStock')}</span>}
            </button>
          );
        })}
      </div>
      {showRequired && (
        <p id="pdp-variants-required" className="pdp-variants__required" role="alert">
          {t('product.chooseVariantFirst')}
        </p>
      )}
    </fieldset>
  );
}
