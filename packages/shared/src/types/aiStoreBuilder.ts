// Feature 13 (AI Store Builder) DTOs. Seller-only (SELLER role + Feature 3's active-store guard).
// No new database table backs any of this — see docs/handoffs/F13-ai-store-builder.md.

export interface AiStagedImageDTO {
  cdnUrl: string;
  position: number; // 0 = primary (mirrors product_images.position convention, Doc 5 §4.7)
}

export interface AiStagingUploadDTO {
  stagingId: string;
  images: AiStagedImageDTO[];
}

// Task 5 — ephemeral, derived-only. Never accepted back as writable input on save.
export interface AiSeoPreviewDTO {
  metaTitle: string;
  metaDescription: string;
}

export interface AiGeneratedDraftDTO {
  titleEn: string;
  titleUr: string;
  descriptionEn: string;
  descriptionUr: string;
  categoryId: string | null; // resolved category — null = no confident match, seller picks manually
  categoryGuess: string; // AI's raw free-text guess, kept for display even when unresolved
  tags: string[]; // truncated to <=10 if the AI over-produced; passed through as-is if <5
  aiGenerated: true;
}

export interface AiGenerateResponseDTO {
  stagingId: string;
  draft: AiGeneratedDraftDTO;
  seoPreview: AiSeoPreviewDTO;
}
