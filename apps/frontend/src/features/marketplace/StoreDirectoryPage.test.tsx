import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '../../app/i18n';
import { useLanguageStore } from '../../lib/languageStore';
import { getCategories } from '../catalog/catalogApi';
import { StoreDirectoryPage } from './StoreDirectoryPage';
import { getStoreDirectory } from './storeApi';

vi.mock('../catalog/catalogApi', () => ({ CATEGORIES_QUERY_KEY: ['catalog', 'categories'], getCategories: vi.fn() }));
vi.mock('./storeApi', () => ({ getStoreDirectory: vi.fn() }));

const item = {
  slug: 'alpha-fabrics', name: 'Alpha Fabrics', description: 'Handmade shirts', logoUrl: null,
  memberSince: '2026-01-01T00:00:00.000Z', productCount: 2,
  category: { id: '3', slug: 'clothing', nameEn: 'Clothing', nameUr: 'کپڑے' }, city: 'Lahore',
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><StoreDirectoryPage /></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCategories).mockResolvedValue([]);
  useLanguageStore.getState().setLanguage('EN');
});
afterEach(() => useLanguageStore.getState().setLanguage('EN'));

describe('Store Directory page', () => {
  it('shows a loading state while stores load', () => {
    vi.mocked(getStoreDirectory).mockImplementation(() => new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('heading', { name: 'Shop by Store' })).toBeInTheDocument();
    expect(screen.getByLabelText('Loading stores…')).toHaveAttribute('aria-busy', 'true');
  });

  it('shows profile details and links to the actual store slug', async () => {
    vi.mocked(getStoreDirectory).mockResolvedValue({ items: [item], page: 1, limit: 12, total: 1, hasMore: false });
    renderPage();
    const link = await screen.findByRole('link', { name: /Alpha Fabrics/ });
    expect(link).toHaveAttribute('href', '/store/alpha-fabrics');
    expect(screen.getByText('Handmade shirts')).toBeInTheDocument();
    expect(screen.getByText('Clothing')).toBeInTheDocument();
    expect(screen.getByText('Lahore')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('shows Urdu store labels in RTL mode', async () => {
    useLanguageStore.getState().setLanguage('UR');
    await i18n.changeLanguage('ur');
    vi.mocked(getStoreDirectory).mockResolvedValue({ items: [item], page: 1, limit: 12, total: 1, hasMore: false });
    renderPage();
    expect(await screen.findByText('کپڑے')).toBeInTheDocument();
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('passes search text to the directory API', async () => {
    vi.mocked(getStoreDirectory).mockResolvedValue({ items: [], page: 1, limit: 12, total: 0, hasMore: false });
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Search stores'), { target: { value: 'cloth' } });
    await waitFor(() => expect(getStoreDirectory).toHaveBeenCalledWith(expect.objectContaining({ q: 'cloth', page: 1 })));
  });

  it('shows an empty state when no stores match', async () => {
    vi.mocked(getStoreDirectory).mockResolvedValue({ items: [], page: 1, limit: 12, total: 0, hasMore: false });
    renderPage();
    expect(await screen.findByText('No stores match your search.')).toBeInTheDocument();
  });

  it('shows a recoverable error when the directory request fails', async () => {
    vi.mocked(getStoreDirectory).mockRejectedValue(new Error('Unavailable'));
    renderPage();
    expect(await screen.findByText('Stores could not be loaded. Please try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
