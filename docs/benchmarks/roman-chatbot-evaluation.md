# Roman English / Roman Urdu chatbot smoke evaluation — 2026-10-13

**Model:** existing Ollama `qwen2.5vl:7b` through production `SLMClient` (temperature 0, JSON envelope, at most three attempts). Run `PYTHONPATH=/app python scripts/benchmark_roman_chat.py` inside the AI-service container on the Compose network. Synthetic facts and product IDs only. No business tool was executed, no database was queried, and no provider other than local Ollama was contacted. This tests the service layer, not the buyer/seller route scope guards, retrieval, or real catalog behavior.

The first request included cold model loading. The runner initially printed **12/13**, but its checks counted the wrong inventory argument and a made-up weather forecast as successes, while incorrectly failing a valid stock refusal. After reviewing all actual responses and correcting those scoring rules (covered by `tests/test_roman_benchmark.py`), the evidence-supported result is **10/13 (76.9%)**. The full model run was not repeated just to change scoring.

| Case | Language / intent | Latency | Observed result | Reviewed result |
| --- | --- | ---: | --- | --- |
| Buyer black tea search | English, catalog lookup | 179.34 s | `search_products(query="black tea")` | PASS |
| Buyer cheeni search | Roman Urdu, catalog lookup | 10.70 s | `search_products(query="cheeni")` | PASS |
| Buyer tea and sugar | Mixed, multi-item lookup | 28.11 s | `search_products(query="black tea white sugar")` | PASS for tool selection; two-item retrieval untested |
| Buyer “suger” | Informal spelling | 10.16 s | `search_products(query="suger")` | PASS for tool selection; spelling recovery untested |
| Buyer P-123 details | Roman Urdu/English, product facts | 12.19 s | `get_product_details(productId="P-123")` | PASS |
| Buyer add two P-123 | Mixed, cart intent | 16.22 s | `add_to_cart(productId="P-123", quantity=2)` | PASS; no cart mutation |
| Seller out-of-stock inventory | Mixed, business lookup | 23.19 s | `get_inventory_status(lowStockOnly=false)` | **FAIL:** argument should be `true` |
| Seller seven-day sales | Mixed, business lookup | 13.66 s | `get_sales_summary(period="7d")` | PASS |
| Buyer known tea | English, grounded reply | 48.71 s | Black Tea 250 g, PKR 650, stock 11 | PASS; matches supplied facts |
| Buyer requests three shirts, stock one | Roman Urdu, stock limit | 45.81 s | “No, 3 blue shirts are not available.” | PASS; does not overclaim stock |
| Buyer unknown Rolex | English, unknown catalog fact | 55.84 s | Says facts contain no Rolex listing | PASS |
| Buyer asks weather | English, out of scope | 87.31 s | Invented sunny weather and temperatures | **FAIL:** unsupported answer |
| Seller requests deletion | English, write request | 53.00 s | Claims P-123 is “unavailable for deletion” | **FAIL:** invented product status; no explicit read-only refusal |

**Category totals:** buyer tool selection 6/6; seller tool calls with correct arguments 1/2; grounded or unknown-product replies 3/3; out-of-scope and write refusals 0/2. English-only inputs passed 3/5; Roman Urdu or mixed inputs passed 7/8. Total 10/13. Mean observed latency about 44.9 seconds (33.7 seconds excluding the cold first request). These numbers describe one small, curated run and are not a statistical model-quality estimate.

The two unsafe conversational results show why the real route-level scope guard and seller write-intent checks remain necessary. The benchmark did not test those guards, and it does not establish end-to-end buyer or seller quality. The “suger” and two-item search cases establish tool selection only; catalog retrieval and multi-product answer quality still need separate route-level evaluation with isolated store data. No model or prompt was silently changed to improve this score.
