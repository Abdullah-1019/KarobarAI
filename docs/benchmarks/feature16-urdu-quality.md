# Feature 16 Urdu quality benchmark

## Status

This is a minimal qualitative smoke benchmark because Feature 16 requires Urdu product-chat
evaluation before selecting a model. It is not an official quality score or a model comparison.
The product facts below are controlled test fixtures, not live catalog records. The currently
installed candidate is `qwen2.5vl:7b`; `llama3.2-vision:11b` is not installed, so no comparison
between the two candidates is possible.

## Cases

The live benchmark script sends five Urdu questions with these catalog facts to the configured
Ollama model. It expects Urdu answers grounded only in the provided facts and never invokes tools.

1. Availability: blue cotton shirt, stock 12.
2. Price: blue cotton shirt, PKR 1,800.
3. Quantity constraint: blue cotton shirt, stock 1; ask for two.
4. Material grounding: blue shirt, cotton blend.
5. Variant grounding: only blue is listed; ask about red.

Run from the AI-service root with Ollama reachable at `OLLAMA_BASE_URL`:

```powershell
python -m scripts.urdu_quality_benchmark
```

The script prints each Urdu question and the model's actual reply. Review answers for Urdu
fluency, correct facts, and unsupported claims. This small set is not statistically representative.

## Run record

On 2026-10-08, the benchmark could not complete. Its temporary Docker runner ended with
`error waiting for container: unexpected EOF`; the Ollama container also exited with code 255.
No Urdu answer was scored. The benchmark must be rerun after Ollama is available. This result is
not evidence of model quality and does not satisfy the Feature 16 model-selection criterion.

On 2026-10-08, reran `python -m scripts.urdu_quality_benchmark` against `qwen2.5vl:7b` in the
Ollama container. Availability included the supplied stock count (12); price matched PKR 1,800;
material and color answers did not invent unavailable attributes. The stock-limit case failed:
with stock 1 and a request for 2, the model answered that the items were available. This is a
clear grounding error; do not use the model's prose as an inventory or purchase authorization.
The candidate comparison is still incomplete because `llama3.2-vision:11b` was not tested.

## 2026-10-09 rerun after inventory-grounding prompt hardening

The shared `SLMClient` now instructs the model to treat reported stock as a hard upper bound,
compare the requested quantity numerically, and never confirm a quantity above stock. A regression
test verifies this rule is included in the system instructions sent to Ollama.

The same five live cases were rerun against `qwen2.5vl:7b`. The stock-limit case now answered
`نہیں` (“no”) for a request for two with stock one, correcting the previous false availability
claim. The other actual replies were: availability `نعم، نیلا کاٹن شرٹ دستیاب ہے۔`; price
`PKR 1,800`; material `نہیں`; unavailable red variant `نہیں`. These were fact-consistent with the
fixtures. The availability answer used Arabic `نعم` rather than Urdu `ہاں`, so Urdu fluency is still
imperfect. This five-case smoke check is qualitative, not a formal accuracy score.

A supplemental live check through the production `SLMClient` tested Urdu product search, product
details, add-to-cart intent, and order-status intent. All four returned valid JSON envelopes with
the expected allowlisted tool type (4/4); the benchmark did not execute any tools. This was a
temporary check, not a committed benchmark suite.

The alternate model remains untested, so this does not provide a model comparison.

## 2026-10-09 JSON-envelope reliability rerun

The existing 10-case benchmark was run inside the AI-service container against `qwen2.5vl:7b`
after inventory-grounding prompt hardening. All 10 cases passed on the initial attempt (10/10,
100%, 0 retries): five conversational reply envelopes and five expected allowlisted tool-call
envelopes. The benchmark parsed envelopes only; no tools or business mutations were executed.

## Related Feature 16 image-to-listing verification

The live backend-to-AI-service-to-Ollama request fetched its development image and entered Qwen
vision decoding, but did not return a `GeneratedListing` before the backend's 600-second deadline.
Ollama remained healthy with about 6.8 GiB / 9.716 GiB in use; no OOM or model crash was observed.
Both the AI-service and backend timeouts are 600 seconds, and the backend timeout maps to the
existing safe 503 response. The evidence indicates slow CPU vision inference, not a timeout
mismatch or request-routing defect. No code change was justified, and image-to-listing remains
**BLOCKED**. The next action is one live run with the same Qwen model on an approved
GPU-accelerated inference host. Earlier JSON, Urdu, embedding, and test results above are
historical checks and were not rerun for this diagnosis.
