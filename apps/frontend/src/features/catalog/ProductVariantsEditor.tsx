import { useEffect, useState } from 'react';
import { Button, Input, InputNumber } from 'antd';
import { Plus, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { setProductVariantsSchema, type ProductVariantDTO } from '@karobarai/shared';
import { toast } from '../../components';
import { productQueryKey, setProductVariants } from './catalogApi';
import { formatCatalogError } from './catalogErrors';
import './ProductVariantsEditor.css';

interface Row {
  key: string;
  id?: string;
  size: string;
  color: string;
  stock: number | null;
}

const toRows = (variants: ProductVariantDTO[]): Row[] =>
  variants.map((v) => ({ key: v.id, id: v.id, size: v.size ?? '', color: v.color ?? '', stock: v.stock }));

let nextKey = 0;

// Feature 23 — the seller's size/colour list for one product, saved on its own. Each row is a
// size and/or colour with its own stock; the product's stock becomes their total. Removing a row
// retires that option (it stays on past orders) rather than deleting it.
export function ProductVariantsEditor({ productId, variants }: { productId: string; variants: ProductVariantDTO[] }) {
  const { t } = useTranslation(['catalog', 'common']);
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<Row[]>(() => toRows(variants));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setRows(toRows(variants)), [variants]);

  const update = (key: string, patch: Partial<Row>) => setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const total = rows.reduce((sum, row) => sum + (row.stock ?? 0), 0);

  async function save() {
    setError(null);
    const parsed = setProductVariantsSchema.safeParse({
      variants: rows.map((row) => ({ ...(row.id ? { id: row.id } : {}), size: row.size, color: row.color, stock: row.stock ?? 0 })),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t('catalog:variants.invalid'));
      return;
    }
    setSaving(true);
    try {
      const updated = await setProductVariants(productId, parsed.data);
      queryClient.setQueryData(productQueryKey(productId), updated);
      toast.success(t('catalog:variants.saved'));
    } catch (err) {
      setError(formatCatalogError(t, err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="slFormCard" aria-labelledby="variants-title">
      <div className="slFormCardHead">
        <h2 className="slPanelTitle" id="variants-title">{t('catalog:variants.title')}</h2>
      </div>
      <p className="pve-hint">{t('catalog:variants.hint')}</p>

      {rows.length > 0 && (
        <div className="pve-table" role="table" aria-label={t('catalog:variants.title')}>
          <div className="pve-row pve-row--head" role="row">
            <span role="columnheader">{t('catalog:variants.size')}</span>
            <span role="columnheader">{t('catalog:variants.color')}</span>
            <span role="columnheader">{t('catalog:variants.stock')}</span>
            <span role="columnheader" className="sr-only">{t('catalog:variants.remove')}</span>
          </div>
          {rows.map((row, index) => (
            <div className="pve-row" role="row" key={row.key}>
              <Input
                value={row.size}
                maxLength={40}
                placeholder={t('catalog:variants.sizePlaceholder')}
                aria-label={`${t('catalog:variants.size')} ${index + 1}`}
                onChange={(event) => update(row.key, { size: event.target.value })}
              />
              <Input
                value={row.color}
                maxLength={40}
                placeholder={t('catalog:variants.colorPlaceholder')}
                aria-label={`${t('catalog:variants.color')} ${index + 1}`}
                onChange={(event) => update(row.key, { color: event.target.value })}
              />
              <InputNumber
                value={row.stock}
                min={0}
                max={100000}
                precision={0}
                aria-label={`${t('catalog:variants.stock')} ${index + 1}`}
                onChange={(value) => update(row.key, { stock: typeof value === 'number' ? value : null })}
                style={{ width: '100%' }}
              />
              <button
                type="button"
                className="pve-remove"
                aria-label={`${t('catalog:variants.remove')} ${index + 1}`}
                onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="pve-actions">
        <Button
          htmlType="button"
          shape="round"
          icon={<Plus size={16} aria-hidden="true" />}
          onClick={() => setRows((current) => [...current, { key: `new-${(nextKey += 1)}`, size: '', color: '', stock: 0 }])}
        >
          {t('catalog:variants.add')}
        </Button>
        {rows.length > 0 && <span className="pve-total">{t('catalog:variants.total', { count: total })}</span>}
        <Button htmlType="button" type="primary" shape="round" loading={saving} onClick={() => void save()} className="pve-save">
          {t('catalog:variants.save')}
        </Button>
      </div>
      {error && <p className="pve-error" role="alert">{error}</p>}
    </section>
  );
}
