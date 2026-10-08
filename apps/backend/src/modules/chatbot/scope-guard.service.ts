import axios from 'axios';

import { config } from '../../core/config';

export interface ScopeGuardConfig {
  exemplarQuestions: string[];
  refusalMessage: { en: string; ur: string };
  similarityThreshold: number;
}

const exemplarCache = new Map<string, Promise<number[][]>>();

async function embed(texts: string[]): Promise<number[][]> {
  const response = await axios.post<{ embeddings: number[][] }>(
    `${config.aiServiceUrl}/internal/embeddings`,
    { texts },
    { timeout: 600_000 },
  );
  const vectors = response.data.embeddings;
  if (
    !Array.isArray(vectors) ||
    vectors.length !== texts.length ||
    vectors.some((vector) => vector.length !== 768 || vector.some((value) => !Number.isFinite(value)))
  ) {
    throw new Error('Embedding service returned invalid scope-guard vectors');
  }
  return vectors;
}

function cosineSimilarity(left: number[], right: number[]): number {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / Math.sqrt(leftNorm * rightNorm);
}

export async function isMessageInScope(message: string, scope: ScopeGuardConfig): Promise<boolean> {
  if (!scope.exemplarQuestions.length) return false;
  const key = JSON.stringify(scope.exemplarQuestions);
  let cached = exemplarCache.get(key);
  if (!cached) {
    cached = embed(scope.exemplarQuestions);
    exemplarCache.set(key, cached);
    cached.catch(() => exemplarCache.delete(key));
  }
  const [exemplars, [messageVector]] = await Promise.all([cached, embed([message])]);
  if (!messageVector || messageVector.length !== 768) return false;
  const similarity = exemplars.reduce((max, vector) => Math.max(max, cosineSimilarity(messageVector, vector)), -1);
  return similarity >= scope.similarityThreshold;
}

export function clearScopeExemplarCacheForTests(): void {
  exemplarCache.clear();
}
