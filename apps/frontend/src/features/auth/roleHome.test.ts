import { describe, expect, it } from 'vitest';

import { roleHomePath } from './roleHome';

describe('roleHomePath', () => {
  it('sends sellers to the seller dashboard', () => {
    expect(roleHomePath('SELLER')).toBe('/seller');
  });

  it('sends admins to the admin area', () => {
    expect(roleHomePath('ADMIN')).toBe('/admin');
  });

  it('sends buyers to the storefront home', () => {
    expect(roleHomePath('BUYER')).toBe('/');
  });
});
