# Feature 18: Seller-Side Business Intelligence Agent

> **Agent Directive:** Depends on Feature 16 (AI Core Infrastructure) — build that first. This feature is read-only end to end: no tool in this module mutates any data. It is configuration on top of the shared agent loop, not new infrastructure.

---

## 1. Goal

An authenticated chatbot inside Seller Center that reasons across the seller's own sales, orders, inventory, reviews, and returns to answer questions and produce real recommendations — not canned text. Scoped strictly to the logged-in seller's own store.

---

## 2. Tool Schema

```typescript
const sellerTools: ToolDefinition[] = [
  { name: 'get_sales_summary', parameters: { period: "'today'|'7d'|'30d'|'custom'", dateFrom: 'string?', dateTo: 'string?' } },
  { name: 'get_order_status', parameters: { orderId: 'string?', statusFilter: 'string?' } },
  { name: 'get_top_products', parameters: { period: 'string', limit: 'number' } },
  { name: 'get_inventory_status', parameters: { lowStockOnly: 'boolean' } },
  { name: 'get_returns_summary', parameters: { period: 'string' } },
  { name: 'get_high_return_products', parameters: { limit: 'number' } },
  { name: 'get_review_summary', parameters: { sortBy: "'most_reviewed'|'lowest_rated'" } },
  { name: 'get_delivery_stats', parameters: { period: 'string' } },
  { name: 'generate_recommendations', parameters: {} }, // composite — see Section 5
];
```

No tool in this list performs a write. This is enforced structurally (Section 5), not just by convention — grep the tool executor file before marking this feature done and confirm zero calls into any `*.create()`, `*.update()`, or `*.delete()` Prisma method.

---

## 3. Example Questions → Tool Mapping

| Question | Tool(s) called |
|---|---|
| "How many sales did I make today?" | `get_sales_summary(period: 'today')` |
| "Which products are selling the most?" | `get_top_products` |
| "How many orders are pending?" | `get_order_status(statusFilter: 'pending-equivalent')` |
| "Which products have the most reviews?" | `get_review_summary(sortBy: 'most_reviewed')` |
| "Which products have poor reviews?" | `get_review_summary(sortBy: 'lowest_rated')` |
| "How many returns did I receive?" | `get_returns_summary` |
| "Which products have the highest return rate?" | `get_high_return_products` |
| "What are my sales trends?" | `get_sales_summary(period: '30d')`, reasoned over by the model |
| "Which products should I promote?" / "What recommendations can you give?" | `generate_recommendations` (chains multiple reads) |
| "How many deliveries completed today?" | `get_delivery_stats(period: 'today')` |
| "What is my overall store performance?" | Agent chains `get_sales_summary` + `get_top_products` + `get_returns_summary` across multiple loop steps |

That last row is the clearest agentic demonstration: a single broad question causes the model to decide, on its own, to call three different tools and synthesize — this is exactly the sequence worth screen-recording for your defense.

---

## 4. Context Builder (`chatbot.context-builder.ts` — seller half)

```typescript
async function buildSellerContext(sellerId: string) {
  // req.user.sub is resolved by requireActiveSeller against the database; use its req.sellerContext.userId.
  // Never trust a seller ID from the request, JWT claims beyond identity, or tool_call payload.
  return {
    storeName: await SellerProfileService.getStoreName(sellerId),
    // no pre-aggregated data here — each tool call fetches fresh, scoped data at call time
  };
}
```

Unlike the buyer side, there's no RAG retrieval here — a seller's own dataset (orders, products, reviews for one store) is small enough that each tool call can query it directly and scope by `sellerId`. Don't add embedding-based retrieval to this feature; it solves a scale problem this feature doesn't have.

---

## 5. Tool Executor (`chatbot.tool-executor.ts` — seller half)

Every function takes `sellerId` as a parameter sourced from the authenticated session (never from the tool_call payload itself — the model never gets to specify whose data to query):

```typescript
async function executeSellerTool(toolCall: ToolCall, sellerId: string): Promise<ToolResult> {
  switch (toolCall.type) {
    case 'get_sales_summary':
      return RevenueAnalyticsRepository.getSummary(sellerId, toolCall.payload.period); // Feature 11, existing
    case 'get_order_status':
      return OrderRepository.findBySellerAndStatus(sellerId, toolCall.payload); // existing
    case 'get_top_products':
      return SalesAnalyticsRepository.getTopProducts(sellerId, toolCall.payload); // Feature 11, existing
    case 'get_inventory_status':
      return ProductRepository.findLowStock(sellerId, toolCall.payload.lowStockOnly); // existing
    case 'get_returns_summary':
      return ReturnRepository.getSummaryBySeller(sellerId, toolCall.payload.period); // existing table, new query method
    case 'get_high_return_products':
      return ReturnRepository.getHighReturnProducts(sellerId, toolCall.payload.limit);
    case 'get_review_summary':
      return ProductReviewRepository.getSummaryBySeller(sellerId, toolCall.payload.sortBy);
    case 'get_delivery_stats':
      return CourierShipmentRepository.getDeliveryStats(sellerId, toolCall.payload.period); // existing table
    case 'generate_recommendations':
      return generateRecommendations(sellerId); // composite, below
    default:
      throw new UnrecognizedToolError(toolCall.type); // fail closed, log, do not execute
  }
}
```

### 5.1 `generate_recommendations` (composite)

```typescript
async function generateRecommendations(sellerId: string) {
  const [sales, topProducts, returns, inventory] = await Promise.all([
    RevenueAnalyticsRepository.getSummary(sellerId, '30d'),
    SalesAnalyticsRepository.getTopProducts(sellerId, { period: '30d', limit: 10 }),
    ReturnRepository.getHighReturnProducts(sellerId, 5),
    ProductRepository.findLowStock(sellerId, true),
  ]);
  return { sales, topProducts, returns, inventory };
  // Raw structured data returned to the model, which synthesizes the actual
  // recommendation text in its response — the backend does not generate
  // recommendation text itself, that's the model's reasoning job.
}
```

This directly reuses Feature 15's intended data sources (per the Master Context doc) — zero new aggregation logic, just composed existing reads.

---

## 6. Routes

```
POST   /api/seller/chat
GET    /api/seller/chat/:sessionId
```

Both behind the existing `SELLER` role middleware — same guard used by every other Seller Center route. No public access path.

---

## 7. Scope Guardrail Config

```typescript
const sellerScopeGuard: ScopeGuardConfig = {
  exemplarQuestions: [
    "how many sales today",
    "which products are selling the most",
    "how many orders are pending",
    "what are my sales trends",
    "which products have poor reviews",
    "what's my return rate",
    "what should I promote",
  ],
  refusalMessage: {
    en: "This question is outside the scope of the KarobarAI seller assistant. I can help with your store's sales, orders, inventory, reviews, returns, and business insights.",
    ur: "یہ سوال کاروبارAI سیلر اسسٹنٹ کے دائرہ کار سے باہر ہے۔ میں آپ کے اسٹور کی فروخت، آرڈرز، انوینٹری، ریویوز، واپسی اور کاروباری بصیرت میں مدد کر سکتا ہوں۔",
  },
  similarityThreshold: 0.5,
};
```

System prompt additionally and explicitly instructs: if asked to change a price, update stock, or take any write action, respond that this assistant is read-only and direct the seller to the relevant dashboard screen — never attempt it, and never fabricate a confirmation that something was changed.

---

## 8. Isolation & Security Checklist

1. `sellerId` is derived from authenticated `req.user.sub` by `requireActiveSeller` and passed as `req.sellerContext.userId` — never from a client field or tool_call payload.
2. `ChatSession.sellerId` fixed at creation, never changes mid-session.
3. Tool executor has **zero** mutating branches — verify by grep (`*.create(`, `*.update(`, `*.delete(`) before sign-off, not by memory.
4. Every tool_call type validated against the Section 2 whitelist before execution.
5. Malformed/unparseable tool_call output fails closed.

---

## 9. Numbered Implementation Tasks

**Task 1 — Seller context builder.** Section 4. Acceptance: returns only the authenticated seller's store name, no other seller's data reachable.

**Task 2 — Seller tool executor.** Section 5, all nine tools. Acceptance: unit tests cover each tool returning correctly scoped data; a test asserting zero mutating Prisma calls exist in this file (static grep check, can be a simple test-time file-content assertion).

**Task 3 — Composite recommendations tool.** Section 5.1. Acceptance: returns correctly shaped combined data from all four sources for a seeded test seller.

**Task 4 — Routes + RBAC + scope guard.** Section 6-7. Acceptance: non-seller JWT rejected with existing auth error shape; in-scope questions answered correctly against seeded data; out-of-scope questions refused.

**Task 5 — Frontend panel.** Chat panel in Seller Center, same base chat component as Feature 17's widget, `context: SELLER_ASSISTANT`. Acceptance: only reachable when authenticated as a seller.

**Task 6 — Tests.** Full conversation flow test for the "overall store performance" multi-tool-chain scenario (this is your agentic proof — assert the agent loop actually made 3 distinct tool calls before responding, not just that the final answer looks right). Cross-seller isolation test. Write-attempt refusal test ("change my product's price to 500" → model responds it can't, no mutation occurs).

---

## 10. Definition of Done

- [x] All nine tools return real, seller-scoped data — isolated live DB verification passed.
- [ ] `generate_recommendations` produces a response synthesized from real combined data, not a canned template — the authenticated live Qwen flow and real combined tool results were verified, but Qwen's first raw synthesis made an unsupported generic claim. The server-side grounding guard returned a verified, data-derived restock response; a grounded raw model synthesis has not been demonstrated.
- [x] Zero mutating code paths anywhere in this module (verified by grep + test).
- [x] The "overall performance" scenario demonstrably chains 3 distinct tool calls in one turn (unit test of the actual loop).
- [x] Out-of-scope and write-attempt questions are refused; the real embedding scope guard was also exercised through the authenticated route.
- [x] All existing backend tests remain green on the disposable environment after repairing the shared seller factory and reset helper; see the verified counts below.

## 11. Implementation and verification status (2026-10-10)

**Status: PARTIAL.** The seller context, nine read-only tools, authenticated routes, persisted seller-owned sessions, scope guard, and Seller Center page are implemented. No schema or migration change was needed. `requireActiveSeller` resolves authenticated `req.user.sub` to the internal seller user ID in `req.sellerContext`; request bodies and tool payloads cannot select a seller. Tool queries are seller-scoped, bounded, strictly validated, and exclude unnecessary customer PII. The executor contains no Prisma create/update/delete/upsert calls.

Inventory handling uses `stock = 0` for `lowStockOnly` because the schema has no configurable threshold; this is explicit in the tool description. The backend suppresses the numeric pagination limit from the model-facing tool result. Real Qwen nevertheless returned false inventory totals twice, so direct inventory-count questions now use the verified tool aggregates for the final response and fail closed when those values are absent.

**Verified:** focused backend unit and route tests passed **22/22** with `--detectOpenHandles`. The disposable PostgreSQL/Redis live suite verified all nine seller-scoped read tools, authenticated chat, persisted messages, session ownership, cross-seller isolation, buyer-role rejection, a real embedding scope-guard refusal with no tool execution, and a real Qwen recommendation request using persisted combined tool results. The first raw recommendation text was generic and unsupported; the response guard replaced it with a grounded recommendation naming the seeded zero-stock product and its verified stock count. The targeted post-fix live recommendation test passed **1/1** (the other four cases were filtered out, not rerun). The final full backend run on the disposable database/Redis passed **88 suites, 794 tests; 3 suites and 7 tests were skipped** (91 suites and 801 tests total), with no open-handle warning. Backend typecheck and build passed; frontend typecheck and production build passed. Vite emitted its large-chunk advisory. Lint scripts have no configured rules. No browser automation was run.

**Test infrastructure fixes:** the seller factory now generates a deterministic unique default `storeSlug` and accepts an override. The reset helper deletes COD remittances and reviews before their restricted parent orders; a helper regression test covers factory defaults/overrides and dependent-row cleanup. The initial fresh-database full-suite attempt was stopped after revealing the repository seed was required; the isolated database was seeded using the existing Prisma seed script, then the complete suite passed. All DB/Redis test operations used disposable loopback-only containers, not shared development services.

**Remaining acceptance gap:** the live Qwen recommendation call is real, and the returned answer is checked against real seller-scoped data, but Qwen's raw natural-language synthesis failed grounding on its first attempt and the verified server guard supplied the final recommendation. Because the specification requires a recommendation synthesized by the model rather than a canned response, this does not yet prove that criterion. A browser interaction was not run; there is no configured browser automation test in the repository. Do not mark Feature 18 complete until a live run demonstrates a grounded raw model synthesis (or the acceptance criterion is explicitly revised).
