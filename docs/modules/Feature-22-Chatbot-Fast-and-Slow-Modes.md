# Feature 22 — Chatbot Fast Mode and Slow Mode

Both AI assistants (Buyer Storefront Assistant and Seller Business Assistant) have a mode selector.

| Mode | Model used when a model is needed | Selector label |
|---|---|---|
| Fast | Gemini (`GEMINI_CHAT_MODEL`, server-side) | Fast Mode — Gemini AI |
| Slow | Existing local Ollama (`OLLAMA_CHAT_MODEL`, `qwen2.5vl:7b`) | Slow Mode — Local Ollama |

The mode chooses the AI provider only. Product search, cart changes, authorization, scope checks and
tool validation are the same code in both modes.

## Request flow

1. The frontend sends `mode: 'fast' | 'slow'` with each chat message (`POST /stores/:slug/chat[/stream]`,
   `POST /seller/chat[/stream]`). The value is checked against an allowlist (zod enum). A request
   **without** `mode` takes the original pre-feature path unchanged.
2. **Buyer:** `buyer-shopping.service.ts` first tries to answer from the database:
   - `shopping-intent.ts` parses English, Roman Urdu and mixed messages into a structured intent
     (no model call).
   - `product-search.service.ts` runs bounded, store-scoped queries on live listings only.
   - Cart changes go through the shared buyer cart tools in `buyer-tool-executor.service.ts`.
3. If the message is not a recognised shopping request, the shared agent loop runs with the selected
   provider and the same allowlisted tools.
4. **Seller:** greetings and inventory counts are answered from the inventory tool without a model.
   Fast Mode then uses Gemini; Slow Mode keeps the embedding scope guard and Ollama. Write requests are
   refused in both modes, as before.

## Handled without a model (both modes)

- Greeting, thanks and "what can you do".
- List products: all, in stock or out of stock.
- Keyword and category search (title and category, with description as a fallback).
- Price filters: under, above, between.
- "Show more" pagination, 8 products per page, with the true total shown.
- Similar products (same category).
- Price and stock of a referenced product.
- Cheapest or most expensive item in the shown list.
- Cart: add (ordinal, "this", "cheapest", by name, or "is mein se black wala"), remove, set quantity, and show cart.

The last shown product list is stored as `shopping` in the assistant message's `tool_result` JSON, so
follow-ups such as "doosra wala" or "#2" resolve to real product IDs. No schema change was needed.

## Safety rules

- Prices and stock come only from the product row. A reply says "added" only when the cart tool returns
  `ok: true`.
- Each message makes at most one cart change. With a `requestId`, the cart result is stored as
  `chat_messages.id = c:<requestId>` before the reply, so a retried request reuses it instead of
  changing the cart again.
- Model tool calls are checked against the tool allowlist and zod schemas, and products must be live
  listings of the current store.
- **No silent fallback.** If Gemini fails, Fast Mode returns `FAST_MODE_NOT_CONFIGURED`,
  `FAST_MODE_RATE_LIMITED`, `FAST_MODE_TIMEOUT` or `FAST_MODE_UNAVAILABLE`. The UI shows a specific
  message and suggests Slow Mode; it never reroutes to Ollama.
- The Gemini key stays in the AI service and is sent in a header (`x-goog-api-key`), never in a URL,
  response or frontend bundle.

## Configuration

Settings live in the AI service and are read from the environment. Docker reads the **root** `.env`.

```
GEMINI_API_KEY=...                    # required for Fast Mode
GEMINI_CHAT_ENABLED=true
GEMINI_CHAT_MODEL=gemini-3.1-flash-lite
GEMINI_CHAT_TIMEOUT_SECONDS=20
GEMINI_CHAT_MAX_OUTPUT_TOKENS=1024
```

The UI remembers the selected mode per browser (`localStorage`: `karobar-ai-mode:buyer`,
`karobar-ai-mode:seller`). The default is Fast.

## Size and colour variants

The schema has no variant model. The parser still reads size and colour words. A colour that is
already part of a title (for example "Black Cotton Shirt") is matched normally. Otherwise the assistant
says no size or colour options are recorded and adds nothing.

`product-variant.adapter.ts` is the only place to change once a variant table exists: fill
`listProductVariants`, then let `add_to_cart` accept the matched `variantId`.

## Measured latency (2026-10-25, development laptop to Neon Singapore)

| Step | Measured |
|---|---|
| Intent parsing | ~0.007 ms per message |
| One catalog search (count + page, parallel) | median ~205 ms, mostly network round trip |
| `findStoreItems` (8 ids) | ~310 ms |
| Gemini `gemini-3.1-flash-lite`, one call | ~1.1–1.6 s |
| Gemini `gemini-flash-lite-latest` alias | 5–8 s (not used for this reason) |
| `gemini-flash-latest` | timed out at 25 s |
| Ollama (Slow Mode) | not measured: Docker was paused |

A full request also makes several sequential database reads (store, session, history, last list). On
the remote Neon database, a deterministic answer therefore takes roughly 1–2 s in total rather than
under 300 ms. A local database would cut this substantially.

## Tests

The backend jest config uses the root `.env`, which points at the shared database, and some suites
call `resetDb()`. Run **only mocked suites**, and block the database URL first:

```bash
cd apps/backend
export DATABASE_URL="postgresql://blocked:blocked@127.0.0.1:1/blocked"
npx jest --coverage=false tests/chatbot/shopping-intent.test.ts tests/chatbot/buyer-shopping.service.test.ts tests/chatbot/chat-modes.test.ts
```

- AI service: `.venv/Scripts/python.exe -m pytest tests/services`
- Frontend: `npx vitest run src/features/ai-chat`
