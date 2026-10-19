import { storeSocialLinksSchema, type StoreSocialLinks } from '@karobarai/shared';

export function storedSocialLinks(value: unknown): StoreSocialLinks {
  const parsed = storeSocialLinksSchema.safeParse(value);
  if (!parsed.success) return {};
  return Object.fromEntries(Object.entries(parsed.data).filter(([, entry]) => typeof entry === 'string')) as StoreSocialLinks;
}

export function mergeSocialLinks(current: unknown, patch: Record<string, string | null | undefined>): StoreSocialLinks {
  const result: Record<string, string> = { ...storedSocialLinks(current) };
  for (const [platform, value] of Object.entries(patch)) {
    if (value === null) delete result[platform];
    else if (value !== undefined) result[platform] = value;
  }
  return result;
}

export function publicSocialLinks(value: unknown): StoreSocialLinks {
  const links = storedSocialLinks(value);
  return links.whatsapp
    ? { ...links, whatsapp: `https://wa.me/${links.whatsapp.slice(1)}` }
    : links;
}
