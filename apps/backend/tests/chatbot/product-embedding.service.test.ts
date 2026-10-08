jest.mock('../../src/core/prisma', () => ({ prisma: { product: { findUnique: jest.fn() }, $executeRaw: jest.fn() } }));
jest.mock('axios');

import axios from 'axios';
import { prisma } from '../../src/core/prisma';
import { buildProductEmbeddingSource, syncProductEmbedding } from '../../src/modules/chatbot/product-embedding.service';

const productFindUnique = jest.mocked(prisma.product.findUnique);
const executeRaw = jest.mocked(prisma.$executeRaw);
const axiosPost = jest.mocked(axios.post);

describe('product embeddings', () => {
  beforeEach(() => {
    productFindUnique.mockReset();
    executeRaw.mockReset();
    axiosPost.mockReset();
  });

  it('builds an embedding source from bilingual text, category and tags', () => {
    const source = buildProductEmbeddingSource({
      titleEn: 'Cotton shirt', titleUr: 'کاٹن شرٹ', descriptionEn: 'Soft fabric', descriptionUr: null,
      category: { nameEn: 'Clothing', nameUr: 'لباس', slug: 'clothing' }, tags: ['cotton', 'blue'],
    });
    expect(source).toContain('Cotton shirt');
    expect(source).toContain('کاٹن شرٹ');
    expect(source).toContain('Clothing');
    expect(source).toContain('cotton, blue');
  });

  it('upserts an embedding only for a current LIVE product', async () => {
    const updatedAt = new Date('2026-01-01T00:00:00Z');
    productFindUnique
      .mockResolvedValueOnce({
        productId: 5n, titleEn: 'Shirt', titleUr: null, descriptionEn: null, descriptionUr: null,
        tags: ['cotton'], category: null, status: 'LIVE', deletedAt: null, updatedAt,
      } as never)
      .mockResolvedValueOnce({ status: 'LIVE', deletedAt: null, updatedAt } as never);
    axiosPost.mockResolvedValue({ data: { embeddings: [[...Array(768)].map(() => 0.1)] } } as never);
    executeRaw.mockResolvedValue(1);

    await expect(syncProductEmbedding(5n)).resolves.toBe('upserted');
    expect(axiosPost).toHaveBeenCalledWith(expect.stringContaining('/internal/embeddings'), expect.any(Object), expect.any(Object));
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });

  it('removes embeddings for products that are no longer LIVE', async () => {
    productFindUnique.mockResolvedValueOnce({ status: 'DRAFT', deletedAt: null } as never);
    executeRaw.mockResolvedValue(1);
    await expect(syncProductEmbedding(5n)).resolves.toBe('deleted');
    expect(axiosPost).not.toHaveBeenCalled();
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });
});
