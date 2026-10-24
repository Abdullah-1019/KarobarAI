import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import '../../app/i18n';
import { useGuestCartStore } from '../cart/guestCartStore';
import { VariantPicker } from './VariantPicker';

const variants = [
  { id: '11', size: 'M', color: 'Black', label: 'M / Black', stock: 3 },
  { id: '12', size: 'L', color: 'Black', label: 'L / Black', stock: 0 },
];

describe('VariantPicker', () => {
  it('lets the buyer pick an in-stock option and disables sold-out ones', () => {
    const onChange = vi.fn();
    render(<VariantPicker variants={variants} value="11" onChange={onChange} />);
    expect(screen.getByRole('button', { name: /M \/ Black/ })).toHaveAttribute('aria-pressed', 'true');
    const soldOut = screen.getByRole('button', { name: /L \/ Black/ });
    expect(soldOut).toBeDisabled();
    fireEvent.click(soldOut);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('asks for a choice when an add was tried without one', () => {
    render(<VariantPicker variants={variants} value={null} onChange={vi.fn()} showRequired />);
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a size or colour first.');
  });
});

describe('guest cart lines with variants', () => {
  beforeEach(() => useGuestCartStore.getState().clear());

  it('keeps each size as its own line and old plain lines unchanged', () => {
    const base = { productId: 'p1', titleEn: 'Shirt', price: '1500', primaryImageUrl: null };
    const store = useGuestCartStore.getState();
    store.addItem({ ...base, variantId: '11', variantLabel: 'M / Black' }, 1);
    store.addItem({ ...base, variantId: '12', variantLabel: 'L / Black' }, 2);
    store.addItem({ ...base, variantId: '11', variantLabel: 'M / Black' }, 1);
    store.addItem({ ...base, productId: 'p2' }, 1);
    expect(useGuestCartStore.getState().items.map((i) => [i.productId, i.variantId ?? null, i.quantity])).toEqual([
      ['p1', '11', 2], ['p1', '12', 2], ['p2', null, 1],
    ]);
    store.removeItem('p1', '12');
    store.updateQuantity('p2', 5);
    expect(useGuestCartStore.getState().items.map((i) => [i.productId, i.variantId ?? null, i.quantity])).toEqual([
      ['p1', '11', 2], ['p2', null, 5],
    ]);
  });
});
