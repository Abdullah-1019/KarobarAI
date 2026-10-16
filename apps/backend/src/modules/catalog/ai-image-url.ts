import { config } from '../../core/config';

/** Keep public URLs in records; use Docker DNS only for the private AI-service fetch. */
export function toAiServiceImageUrl(imageUrl: string): string {
  const publicBase = config.storage.publicBaseUrl.replace(/\/+$/, '');
  const internalBase = config.aiServiceImageBaseUrl.replace(/\/+$/, '');
  const publicPrefix = `${publicBase}/${config.storage.bucket}/`;
  return internalBase && imageUrl.startsWith(publicPrefix)
    ? `${internalBase}/${imageUrl.slice(publicBase.length + 1)}`
    : imageUrl;
}
