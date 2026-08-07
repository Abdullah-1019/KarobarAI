import { prisma } from '../../core/prisma';

// Task 4.1 — best-effort match against existing categories.name_en/name_ur (categories are
// seeded reference data, Doc 5 §4.5, reused read-only — never auto-created from AI free text,
// this task's own Engineering Decision). Exact match first, then a simple substring fallback;
// null (not an error) when nothing confident matches — the seller picks manually, preserving
// REQ-F-Store003's "publishing requires... category" as a still-enforced, seller-confirmed step.
export async function resolveCategory(aiCategoryGuess: string): Promise<bigint | null> {
  const categories = await prisma.category.findMany({ select: { categoryId: true, nameEn: true, nameUr: true } });
  const normalized = aiCategoryGuess.trim().toLowerCase();
  if (!normalized) return null;

  const exact = categories.find((c) => c.nameEn.toLowerCase() === normalized || c.nameUr === aiCategoryGuess.trim());
  if (exact) return exact.categoryId;

  // Guard against a very short guess ("a", "the") substring-matching almost every category name.
  if (normalized.length < 3) return null;

  const fuzzy = categories.find((c) => {
    const nameEnLower = c.nameEn.toLowerCase();
    return nameEnLower.includes(normalized) || normalized.includes(nameEnLower);
  });
  return fuzzy ? fuzzy.categoryId : null;
}
