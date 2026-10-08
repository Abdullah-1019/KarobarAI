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
