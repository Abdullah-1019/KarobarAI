import fs from 'node:fs';
import path from 'node:path';

const SRC_ROOT = path.join(__dirname, '../../src');

function listTsFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listTsFiles(fullPath);
    return entry.name.endsWith('.ts') ? [fullPath] : [];
  });
}

const allSourceFiles = listTsFiles(SRC_ROOT);
const aiModuleFiles = allSourceFiles.filter((file) => file.includes(`${path.sep}modules${path.sep}ai-store-builder${path.sep}`));

describe('Feature 13 (AI Store Builder) reuse/scope audit', () => {
  it('no direct products-table write exists in the ai-store-builder module — only catalog.service.ts (Feature 4) ever writes products', () => {
    const hits = aiModuleFiles.filter((file) => /\.product\.(create|update|updateMany|delete|deleteMany|upsert)\(/.test(fs.readFileSync(file, 'utf-8')));
    expect(hits).toEqual([]);
  });

  it('the save step calls Feature 4\'s existing createProduct/updateProduct/publishProduct/markAiGenerated — no parallel implementation', () => {
    const content = fs.readFileSync(path.join(SRC_ROOT, 'modules/ai-store-builder/ai-store-builder.service.ts'), 'utf-8');
    expect(content).toContain("from '../catalog/catalog.service'");
    expect(content).toContain('catalogService.createProduct(');
    expect(content).toContain('catalogService.updateProduct(');
    expect(content).toContain('catalogService.publishProduct(');
    expect(content).toContain('catalogService.markAiGenerated(');
  });

  it('the Store-Setup-Wizard-completion guard reuses requireActiveSeller (Feature 3/4) — not reimplemented', () => {
    const content = fs.readFileSync(path.join(SRC_ROOT, 'modules/ai-store-builder/ai-store-builder.routes.ts'), 'utf-8');
    expect(content).toContain("from '../../core/middleware/requireActiveSeller'");
  });

  it('image validation reuses the existing Sec-012 utility — no duplicate magic-byte/size check', () => {
    const content = fs.readFileSync(path.join(SRC_ROOT, 'modules/ai-store-builder/ai-store-builder.service.ts'), 'utf-8');
    expect(content).toContain("from '../../core/upload/imageValidation'");
    expect(content).not.toMatch(/0xff.{0,20}0xd8/); // no reimplemented JPEG magic-byte check
  });

  it('no LLM model name is ever hardcoded on the Core API side — it only calls the generic /generate-listing endpoint', () => {
    const hits = aiModuleFiles.filter((file) => /gpt-4|gpt-3\.5|gemini-/i.test(fs.readFileSync(file, 'utf-8')));
    expect(hits).toEqual([]);
  });

  it('the Core API never calls an LLM provider directly — only the AI Service, via config.aiServiceUrl', () => {
    const content = fs.readFileSync(path.join(SRC_ROOT, 'modules/ai-store-builder/ai-store-builder.service.ts'), 'utf-8');
    expect(content).toContain('config.aiServiceUrl');
    expect(content).not.toMatch(/generativelanguage\.googleapis\.com|api\.openai\.com/);
  });

  it('no new Prisma model was added for this feature — products/product_images/categories all pre-existing', () => {
    const schema = fs.readFileSync(path.join(SRC_ROOT, '../prisma/schema.prisma'), 'utf-8');
    expect(schema).toMatch(/model Product \{/);
    expect(schema).toMatch(/model ProductImage /);
    expect(schema).not.toMatch(/model (AiDraft|StagingUpload|SeoMetadata) \{/);
  });

  it('staged image promotion is the only new product_images write path in this feature, distinct from Feature 4\'s file-upload path', () => {
    const content = fs.readFileSync(path.join(SRC_ROOT, 'modules/ai-store-builder/ai-store-builder.service.ts'), 'utf-8');
    expect(content).toContain('prisma.productImage.createMany(');
  });
});
