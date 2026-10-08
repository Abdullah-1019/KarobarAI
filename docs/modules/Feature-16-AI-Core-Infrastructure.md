# Feature 16: AI Core Infrastructure — Self-Hosted SLM, RAG Embeddings & Agentic Engine

> **Agent Directive:** This is the foundational AI layer that Feature 17 (Buyer Chatbot) and Feature 18 (Seller Assistant) both depend on. Build this first, fully, before starting either. Follow the existing Controller-Service-Repository pattern and response envelope used throughout the codebase. Do not break the existing 740+ backend tests or the AI-service pytest suite — run both suites after each task. All AI inference in this project runs on self-hosted, open-weight models served via Ollama — no commercial AI vendor API (OpenAI, Google, Anthropic) is called anywhere in the deployed system.

---

## 1. Goal

Provide one shared, reusable AI substrate: (a) a self-hosted model client, (b) a vector-embedding/retrieval layer (pgvector on the existing Postgres), and (c) a generic multi-step agent reasoning loop. Features 17 and 18 are thin configuration on top of this — different tool schemas and context builders, same engine underneath.

---

## 2. Model Selection & Hosting

- Serving layer: **Ollama**, self-hosted, OpenAI-compatible REST API.
- Chat/vision model: `llama3.2-vision:11b` or `qwen2.5vl:7b` (Q4_K_M quantized) — benchmark both on real Urdu product data before committing; this same model is reused for listing generation (Feature 13 migration), the buyer chatbot, and the seller assistant.
- Embedding model: `nomic-embed-text` (or equivalent small embedding model available in Ollama) — dedicated, separate from the chat model, used only for RAG retrieval (Section 4).
- Add an `ollama` service to the existing `infra/docker-compose.yml`, alongside Postgres/Redis/MinIO, following the same service-definition pattern. Internal network only, not publicly exposed.

---

## 3. Shared SLM Client (`apps/ai-service/app/services/slm_client.py`)

```python
class SLMClient:
    def __init__(self, base_url: str, model: str):
        self.base_url = base_url
        self.model = model

    async def chat(self, messages: list[dict], tools: list[dict] | None = None,
                    response_format: dict | None = None) -> dict:
        # POST {base_url}/v1/chat/completions — supports text, image content blocks,
        # tools (function calling), response_format (structured JSON mode)
        ...

class EmbeddingClient:
    def __init__(self, base_url: str, model: str):
        self.base_url = base_url
        self.model = model

    async def embed(self, texts: list[str]) -> list[list[float]]:
        # POST {base_url}/api/embeddings
        ...
```

Reuse the existing retry/backoff orchestrator pattern already built for AI calls in this codebase — port its structure (wrapper class, exponential backoff, max retries) rather than writing new retry logic. Tune timeouts for local-inference latency rather than cloud rate-limit behavior.

Config: `OLLAMA_BASE_URL`, `OLLAMA_CHAT_MODEL`, `OLLAMA_EMBED_MODEL` in environment.

---

## 4. RAG Layer — Product Embeddings (`pgvector`)

### 4.1 Why this exists (keep this framing in any doc/demo — it's your justification)

Stuffing a store's entire product catalog into every chat request doesn't scale past a few dozen products and wastes context on irrelevant items. Retrieval fixes this: embed each product once, retrieve only the top-k relevant to the buyer's actual question.

### 4.2 Schema addition

```prisma
model ProductEmbedding {
  id        String   @id @default(cuid())
  productId String   @unique
  embedding Unsupported("vector(768)") // dimension matches the chosen embedding model's output
  updatedAt DateTime @updatedAt

  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([productId])
}
```

Enable the extension in a raw SQL migration step: `CREATE EXTENSION IF NOT EXISTS vector;` — run this before the Prisma migration that creates `ProductEmbedding`, since Prisma can't enable extensions itself.

### 4.3 Embedding pipeline

- On product create/update (`LIVE` status), enqueue a BullMQ job (reuse the existing BullMQ setup from Feature 8/9) that: builds an embedding-source string from title + description + category + tags + variant attributes, calls `EmbeddingClient.embed()`, upserts the `ProductEmbedding` row.
- Backfill job: a one-time script embedding all existing `LIVE` products, run once during this feature's rollout.

### 4.4 Retrieval function (`apps/backend/src/modules/chatbot/rag.service.ts`)

```typescript
async function retrieveRelevantProducts(storeId: string, queryEmbedding: number[], k = 8): Promise<Product[]> {
  // raw SQL: SELECT p.* FROM "Product" p
  // JOIN "ProductEmbedding" e ON e."productId" = p.id
  // WHERE p."storeId" = $storeId AND p.status = 'LIVE'
  // ORDER BY e.embedding <=> $queryEmbedding LIMIT $k
}
```

**Mandatory:** the `storeId` filter is applied in the same SQL query as the vector search, not as a post-filter in application code — this is a hard isolation boundary (a cross-store retrieval bug here would leak another seller's catalog into a buyer's chat).

---

## 5. Generic Agent Loop (`apps/backend/src/modules/chatbot/agent-loop.service.ts`)

Shared by Feature 17 and Feature 18 — this is what makes the system genuinely agentic rather than a single intent-match-and-respond function.

```typescript
async function runAgentLoop(params: {
  systemPrompt: string;
  tools: ToolDefinition[];
  history: ChatMessage[];
  userMessage: string;
  toolExecutor: (toolCall: ToolCall) => Promise<ToolResult>;
  maxSteps?: number; // default 4 — hard cap, prevents runaway loops
}): Promise<{ finalReply: string; steps: { toolCall: ToolCall; toolResult: ToolResult }[] }> {
  const steps = [];
  let messages = [...history, { role: 'user', content: userMessage }];

  for (let i = 0; i < (params.maxSteps ?? 4); i++) {
    const response = await slmClient.chat(messages, params.tools);
    if (!response.tool_call) {
      return { finalReply: response.reply, steps };
    }
    const toolResult = await params.toolExecutor(response.tool_call); // validated, per Feature 17/18 rules
    steps.push({ toolCall: response.tool_call, toolResult });
    messages.push({ role: 'assistant', content: response.reply, tool_call: response.tool_call });
    messages.push({ role: 'tool', content: JSON.stringify(toolResult) });
  }
  return { finalReply: "I wasn't able to complete that — could you rephrase?", steps };
}
```

This is the core agentic mechanism: the model decides per-turn whether it has enough information to answer or needs another tool call, and can chain multiple tool calls (e.g., `search_products` → `get_product_details`) before producing a final reply. `maxSteps` is a safety cap, not a normal-path limit — log a warning if a loop hits it, since that signals either a confusing query or a tool schema gap worth revisiting.

---

## 6. Shared Database Schema (`ChatSession` / `ChatMessage`)

```prisma
enum ChatContext {
  BUYER_STORE
  SELLER_ASSISTANT
}

enum ChatRole {
  USER
  ASSISTANT
  SYSTEM
  TOOL
}

model ChatSession {
  id          String         @id @default(cuid())
  context     ChatContext
  storeId     String?        // set for BUYER_STORE, null for SELLER_ASSISTANT
  sellerId    String?        // set for SELLER_ASSISTANT, null for BUYER_STORE
  buyerUserId String?        // nullable — anonymous/guest buyers allowed
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  store       Store?         @relation(fields: [storeId], references: [id], onDelete: Cascade)
  seller      SellerProfile? @relation(fields: [sellerId], references: [id], onDelete: Cascade)
  buyer       User?          @relation(fields: [buyerUserId], references: [id], onDelete: SetNull)
  messages    ChatMessage[]

  @@index([storeId])
  @@index([sellerId])
  @@index([buyerUserId])
}

model ChatMessage {
  id         String      @id @default(cuid())
  sessionId  String
  role       ChatRole
  content    String      @db.Text
  toolCall   Json?
  toolResult Json?
  createdAt  DateTime    @default(now())

  session    ChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
}
```

Add relation fields to existing models: `Store.chatSessions ChatSession[]`, `SellerProfile.chatSessions ChatSession[]`, `User.chatSessions ChatSession[]`.

Add to `PlatformConfig`: `chatbotEnabled Boolean @default(true)` — single kill-switch for both chatbots.

---

## 7. Scope Guardrail Infrastructure (shared mechanism, feature-specific exemplars)

Two layers, both built here, parameterized per-feature in 17/18:

1. **System-prompt refusal examples** — each feature supplies 3-4 few-shot examples of off-topic input + the canned refusal text, inserted into its system prompt.
2. **Embedding-similarity backstop** (`apps/backend/src/modules/chatbot/scope-guard.service.ts`) — each feature supplies a list of in-scope exemplar questions; these are embedded once (reusing `EmbeddingClient`) and cached. On each incoming message, embed it and compare to the exemplar set; if similarity is below a threshold (tune empirically, start ~0.5 cosine) **and** the agent loop's first step produced no tool call, short-circuit and return the canned out-of-scope message without completing generation.

```typescript
interface ScopeGuardConfig {
  exemplarQuestions: string[];
  refusalMessage: { en: string; ur: string };
  similarityThreshold: number;
}
```

---

## 8. Numbered Implementation Tasks

**Task 1 — Ollama infrastructure**
Add `ollama` service to Docker Compose, pull both chat and embedding models on container start. Acceptance: `curl` from inside `ai-service` container returns valid completions and embeddings.

**Task 2 — SLM + Embedding clients**
Build `slm_client.py` with `SLMClient` and `EmbeddingClient`, port the retry orchestrator. Acceptance: unit tests against a running Ollama container return valid chat and embedding responses.

**Task 3 — pgvector + ProductEmbedding**
Enable the extension, add the Prisma model, run migration. Acceptance: migration applies cleanly on fresh + seeded DB, no drift, all 740 existing tests pass.

**Task 4 — Embedding pipeline**
BullMQ job for create/update, backfill script for existing products. Acceptance: creating/updating a `LIVE` product results in a `ProductEmbedding` row within one job cycle; backfill script embeds 100% of existing live products with a logged success/failure count.

**Task 5 — Retrieval service**
Implement `retrieveRelevantProducts`, with the storeId-in-SQL isolation rule. Acceptance: unit test confirms a query against Store A never returns a Store B product, even with a crafted/malicious embedding vector.

**Task 6 — Agent loop engine**
Implement `runAgentLoop` with the step cap and logging. Acceptance: unit test with a mocked SLM client confirms multi-step tool chaining works, confirms the step cap is enforced, confirms a no-tool-call response returns immediately on step 1.

**Task 7 — Shared schema**
Apply Section 6 schema changes, migrate. Acceptance: clean migration, all existing tests pass.

**Task 8 — Scope guard service**
Implement `scope-guard.service.ts` per Section 7. Acceptance: unit test with a sample exemplar set correctly flags 5 known off-topic questions and passes 5 known in-scope questions.

---

## 9. Definition of Done

- [ ] No commercial AI vendor API called anywhere in this layer.
- [ ] `ProductEmbedding` stays in sync with `Product` create/update via the BullMQ pipeline.
- [ ] Cross-store retrieval leak test passes.
- [ ] Agent loop correctly chains at least 2 sequential tool calls in a test scenario before producing a final reply.
- [ ] Scope guard correctly rejects out-of-scope input before invoking the full agent loop.
- [ ] All existing tests remain green.

This feature produces no user-facing behavior on its own — Features 17 and 18 consume it. Do not attempt to demo this feature in isolation.
