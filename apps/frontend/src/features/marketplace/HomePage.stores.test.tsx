import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '../../app/i18n';
import i18n from '../../app/i18n';
import { useLanguageStore } from '../../lib/languageStore';
import { HomePage } from './HomePage';
import { getFeaturedStores } from './storeApi';

vi.mock('./storeApi', () => ({ getFeaturedStores: vi.fn() }));
vi.mock('./marketplaceApi', () => ({ HOME_FEED_QUERY_KEY: ['marketplace', 'home'], getHomeFeed: () => new Promise(() => {}) }));
vi.mock('./Hero', () => ({ Hero: () => <div /> }));
vi.mock('./TrustStrip', () => ({ TrustStrip: () => <div /> }));
vi.mock('./ProductGridSkeleton', () => ({ ProductGridSkeleton: () => <div /> }));
vi.mock('./CategoryGrid', () => ({ CategoryGrid: () => <div /> }));
vi.mock('./FeaturedProducts', () => ({ FeaturedProducts: () => <div /> }));
vi.mock('./NewArrivalsGrid', () => ({ NewArrivalsGrid: () => <div /> }));
vi.mock('./AiBanner', () => ({ AiBanner: () => <div /> }));

function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><HomePage /></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => vi.clearAllMocks());

describe('homepage store section', () => {
  it('shows loading placeholders while featured stores load', () => {
    vi.mocked(getFeaturedStores).mockImplementation(() => new Promise(() => {}));
    renderHome();
    expect(screen.getByLabelText('Loading stores…')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('link', { name: /View all stores/ })).toHaveAttribute('href', '/stores');
  });

  it('shows an eligible store card linked to its public profile', async () => {
    vi.mocked(getFeaturedStores).mockResolvedValue([{
      slug: 'alpha-fabrics', name: 'Alpha Fabrics', description: 'Handmade shirts', logoUrl: null,
      memberSince: '2026-01-01T00:00:00.000Z', productCount: 2,
      category: { id: '3', slug: 'clothing', nameEn: 'Clothing', nameUr: 'کپڑے' }, city: 'Lahore',
    }]);
    renderHome();
    expect(await screen.findByRole('link', { name: /Alpha Fabrics/ })).toHaveAttribute('href', '/store/alpha-fabrics');
    expect(screen.getByText('Handmade shirts')).toBeInTheDocument();
  });

  it('shows an empty state without hiding navigation', async () => {
    vi.mocked(getFeaturedStores).mockResolvedValue([]);
    renderHome();
    expect(await screen.findByText('No stores are available yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View all stores/ })).toHaveAttribute('href', '/stores');
  });

  it('shows the Urdu description in Urdu mode when one is saved', async () => {
    useLanguageStore.getState().setLanguage('UR');
    await i18n.changeLanguage('ur');
    vi.mocked(getFeaturedStores).mockResolvedValue([{
      slug: 'alpha-fabrics', name: 'Alpha Fabrics', description: 'English description',
      descriptionUr: 'اردو میں اسٹور کی تفصیل', logoUrl: null,
      memberSince: '2026-01-01T00:00:00.000Z', productCount: 2, category: null, city: null,
    }]);
    try {
      renderHome();
      expect(await screen.findByText('اردو میں اسٹور کی تفصیل')).toBeInTheDocument();
      expect(screen.queryByText('English description')).not.toBeInTheDocument();
    } finally {
      useLanguageStore.getState().setLanguage('EN');
      await i18n.changeLanguage('en');
    }
  });

  it('shows a retry action when featured stores fail', async () => {
    vi.mocked(getFeaturedStores).mockRejectedValue(new Error('Unavailable'));
    renderHome();
    expect(await screen.findByText('Stores could not be loaded. Please try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
