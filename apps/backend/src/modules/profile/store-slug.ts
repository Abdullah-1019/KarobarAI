export function createStoreSlug(storeName: string, userPublicId: string): string {
  const base = storeName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'store';
  return `${base}-${userPublicId.toLowerCase()}`;
}
