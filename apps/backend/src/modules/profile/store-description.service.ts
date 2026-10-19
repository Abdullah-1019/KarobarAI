import axios from 'axios';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { config } from '../../core/config';
import { AuthError, BusinessRuleError, ConflictError, DependencyError, RateLimitError } from '../../core/errors/AppError';
import { logger } from '../../core/logger';
import { prisma } from '../../core/prisma';
import { redis } from '../../core/redis';

export const generateStoreDescriptionSchema = z.object({
  businessDetails: z.string().trim().max(500).optional(),
}).strict();
export type GenerateStoreDescriptionInput = z.infer<typeof generateStoreDescriptionSchema>;

const suggestionSchema = z.object({
  descriptionEn: z.string().trim().min(20).max(1000),
  descriptionUr: z.string().trim().min(20).max(1000),
}).strict().refine((value) => /[\u0600-\u06ff]/u.test(value.descriptionUr), {
  path: ['descriptionUr'],
  message: 'Urdu description must contain Urdu script',
});

export type StoreDescriptionSuggestion = z.infer<typeof suggestionSchema>;

export function parseStoreDescriptionSuggestion(value: unknown): StoreDescriptionSuggestion | null {
  const parsed = suggestionSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

const LOCK_MS = 125_000;
const WINDOW_MS = 15 * 60_000;
const MAX_GENERATIONS = 5;

export async function generateStoreDescription(
  publicId: string,
  input: GenerateStoreDescriptionInput,
): Promise<StoreDescriptionSuggestion> {
  const user = await prisma.user.findUnique({
    where: { publicId },
    select: {
      userId: true,
      sellerProfile: {
        select: {
          onboardingCompletedAt: true,
          storeName: true,
          city: true,
          storeCategory: { select: { nameEn: true, nameUr: true } },
        },
      },
    },
  });
  if (!user) throw new AuthError();
  const store = user.sellerProfile;
  if (!store?.onboardingCompletedAt) {
    throw new BusinessRuleError('Complete store onboarding first', undefined, 'STORE_NOT_ONBOARDED');
  }
  if (!store.storeName.trim() || (!store.storeCategory && !input.businessDetails?.trim())) {
    throw new BusinessRuleError('Add a store category or business details before generating', undefined, 'STORE_DESCRIPTION_NEEDS_DETAILS');
  }

  const lockKey = `lock:f21:store-description:${user.userId}`;
  const rateKey = `rate:f21:store-description:${user.userId}`;
  const lockToken = randomUUID();
  try {
    const acquired = await redis.set(lockKey, lockToken, 'PX', LOCK_MS, 'NX');
    if (acquired !== 'OK') throw new ConflictError('Store description generation is already in progress', undefined, 'STORE_DESCRIPTION_IN_PROGRESS');
  } catch (error) {
    if (error instanceof ConflictError) throw error;
    throw new DependencyError('Description generation is temporarily unavailable', undefined, 'STORE_DESCRIPTION_UNAVAILABLE');
  }

  try {
    const count = Number(await redis.eval(
      "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]); end; return n",
      1, rateKey, WINDOW_MS,
    ));
    if (count > MAX_GENERATIONS) throw new RateLimitError('Try again later', undefined, 'STORE_DESCRIPTION_RATE_LIMIT');

    // Only public store facts and seller-supplied details reach the private AI service,
    // which sends them to the same configured Gemini provider used for product listing.
    const facts = {
      name: store.storeName,
      categoryEn: store.storeCategory?.nameEn ?? null,
      categoryUr: store.storeCategory?.nameUr ?? null,
      city: store.city,
      businessDetails: input.businessDetails?.trim() || null,
    };
    const response = await axios.post<unknown>(`${config.aiServiceUrl}/internal/generate-store-description`, facts, {
      timeout: Math.min(config.aiServiceTimeoutMs, 100_000),
    });

    const suggestion = parseStoreDescriptionSuggestion(response.data);
    if (!suggestion) {
      logger.warn('[store-description] AI service returned invalid suggestion');
      throw new DependencyError('Could not generate a usable description. You can write one manually.', undefined, 'STORE_DESCRIPTION_INVALID');
    }
    return suggestion;
  } catch (error) {
    if (error instanceof DependencyError || error instanceof RateLimitError) throw error;
    const shaped = error as { code?: string; response?: { status?: number } } | null;
    if (shaped?.response?.status === 429) {
      throw new RateLimitError('Description provider is rate limited; try again later', undefined, 'STORE_DESCRIPTION_PROVIDER_RATE_LIMIT');
    }
    logger.warn({ code: shaped?.code, status: shaped?.response?.status }, '[store-description] AI service unavailable');
    throw new DependencyError('Description generation is temporarily unavailable. You can write one manually.', undefined, 'STORE_DESCRIPTION_UNAVAILABLE');
  } finally {
    // Compare token before unlocking: an expired lock may belong to a newer request.
    try {
      await redis.eval("if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end", 1, lockKey, lockToken);
    } catch {
      logger.warn('[store-description] Lock cleanup deferred until TTL');
    }
  }
}
