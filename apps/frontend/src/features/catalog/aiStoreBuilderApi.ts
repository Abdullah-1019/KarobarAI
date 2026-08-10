import type { AiGenerateResponseDTO, AiStagingUploadDTO, AiSaveProductInput, ProductDetailDTO } from '@karobarai/shared';

import type { ApiEnvelope } from '../../api';
import { apiClient, unwrap } from '../../api';

// Feature 13 (AI Store Builder) — F13-ai-store-builder.md. SCR-S02's flagship 3-step flow: stage
// image(s) (no product row exists yet) -> AI-generate a bilingual draft against the staged
// image(s) -> save (creates the product, promotes staged images, optionally publishes). All three
// share one `stagingId`, a Redis-backed correlation key (TTL 1h) — never a Postgres row until save.

export function uploadStagingImages(files: File[]): Promise<AiStagingUploadDTO> {
  const formData = new FormData();
  for (const file of files) formData.append('images', file);
  return unwrap(apiClient.post<ApiEnvelope<AiStagingUploadDTO>>('/products/ai-generate/upload', formData));
}

export function generateDraft(stagingId: string, categoryHint?: string): Promise<AiGenerateResponseDTO> {
  return unwrap(apiClient.post<ApiEnvelope<AiGenerateResponseDTO>>('/products/ai-generate', { stagingId, categoryHint }));
}

// Stateless and doubles as the manual-entry fallback (REQ-F-Store005) — a seller whose generation
// failed still saves through this same endpoint, `aiGenerated` explicit rather than inferred.
export function saveAiProduct(input: AiSaveProductInput): Promise<ProductDetailDTO> {
  return unwrap(apiClient.post<ApiEnvelope<ProductDetailDTO>>('/products/ai-generate/save', input));
}
