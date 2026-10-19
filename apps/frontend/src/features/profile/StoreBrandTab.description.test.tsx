import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SellerProfileDTO } from '@karobarai/shared';
import '../../app/i18n';
import i18n from '../../app/i18n';
import { StoreBrandTab } from './StoreBrandTab';
import { generateStoreDescription, updateSellerProfile } from './profileApi';

vi.mock('../catalog/catalogApi', () => ({ CATEGORIES_QUERY_KEY: ['categories'], getCategories: vi.fn().mockResolvedValue([]) }));
vi.mock('./profileApi', () => ({
  PROFILE_QUERY_KEY: ['profile', 'me'], STORE_STATUS_QUERY_KEY: ['profile', 'store', 'status'],
  getStoreStatus: vi.fn().mockResolvedValue({ status: 'ACTIVE', since: '2026-01-01T00:00:00.000Z' }),
  generateStoreDescription: vi.fn(), updateSellerProfile: vi.fn(),
  uploadStoreLogo: vi.fn(), removeStoreLogo: vi.fn(), uploadStoreBanner: vi.fn(), removeStoreBanner: vi.fn(),
}));
vi.mock('../../components', () => ({
  EmptyState: () => <div />,
  ImageUploader: () => <div />,
  StatusChip: () => <span>Active</span>,
  toast: { success: vi.fn() },
}));

const profile: SellerProfileDTO = {
  id: 'seller', role: 'SELLER', status: 'ACTIVE', preferredLanguage: 'EN', avatarUrl: null,
  createdAt: '2026-01-01T00:00:00.000Z', storeName: 'Cloth Corner', storeDescription: 'Saved English text',
  storeDescriptionUr: 'پہلے سے محفوظ اردو متن', storeCategory: { id: '3', slug: 'clothing', nameEn: 'Clothing', nameUr: 'کپڑے' },
  city: 'Lahore', socialLinks: {}, logoUrl: null, bannerUrl: null, hasStore: true,
};
const suggestion = {
  descriptionEn: 'Cloth Corner is a clothing store in Lahore. Browse the available items.',
  descriptionUr: 'کلاتھ کارنر لاہور میں کپڑوں کا اسٹور ہے۔ دستیاب اشیاء دیکھیں۔',
};

function renderTab() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter><StoreBrandTab profile={profile} /></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => { vi.clearAllMocks(); vi.mocked(updateSellerProfile).mockResolvedValue(profile); });
afterEach(async () => { await i18n.changeLanguage('en'); });

describe('editable bilingual store descriptions', () => {
  it('previews AI output without saving or overwriting the current form until Apply is clicked', async () => {
    vi.mocked(generateStoreDescription).mockResolvedValue(suggestion);
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate descriptions' }));
    expect(await screen.findByText(suggestion.descriptionEn)).toBeInTheDocument();
    expect(screen.getByLabelText('Store description (English)')).toHaveValue('Saved English text');
    expect(updateSellerProfile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Use this suggestion' }));
    expect(screen.getByLabelText('Store description (English)')).toHaveValue(suggestion.descriptionEn);
    expect(screen.getByLabelText('Store description in Urdu')).toHaveValue(suggestion.descriptionUr);
    expect(updateSellerProfile).not.toHaveBeenCalled();
  });

  it('allows manual English and Urdu editing and saving when AI is unavailable', async () => {
    vi.mocked(generateStoreDescription).mockRejectedValue(new Error('provider unavailable'));
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate descriptions' }));
    expect(await screen.findByText(/You can still write and save them manually/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Store description (English)'), { target: { value: 'My edited English description' } });
    fireEvent.change(screen.getByLabelText('Store description in Urdu'), { target: { value: 'میری اپنی اردو تفصیل' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(updateSellerProfile).toHaveBeenCalledWith(expect.objectContaining({
      storeDescription: 'My edited English description', storeDescriptionUr: 'میری اپنی اردو تفصیل',
    })));
  });

  it('keeps the Urdu editor right-to-left with Urdu labels', async () => {
    await i18n.changeLanguage('ur');
    renderTab();
    expect(screen.getByLabelText('اسٹور کی اردو تفصیل')).toHaveAttribute('dir', 'rtl');
  });
});
