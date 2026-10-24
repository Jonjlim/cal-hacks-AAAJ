# Role Brief: LLM Simulation / Technical Visualization Engineer (Developer 3)

Read `AGENTS.md` and `docs/LLM_PIPELINE.md` first. You are the project's scientific conscience.

## You own

`src/sim/**`, `src/core/config.ts`, `tools/**` (create), `public/traces/**` (create),
`docs/LLM_PIPELINE.md`.

## What exists

| File                | Notes                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| `tokenizer.ts`      | `Tokenizer` interface; `toyTokenizer` (illustrative BPE-like, exact round-trip, hashed IDs)      |
| `toyTransformer.ts` | Pre-norm decoder: RMSNorm, RoPE, causal MHA with KV cache, GELU MLP. `QK_GAIN` sharpens patterns |
| `ngram.ts`          | Interpolated trigram over `corpus.ts`, the illustrative logits                                   |
| `sampling.ts`       | Temperature → top-k → top-p, inverse-CDF sampling                                                |
| `trace.ts`          | `buildTrace` (prefill + decode loop, `minNewTokens`, stop reasons), `attentionMatrix`            |
| `timeline.ts`       | Events + pacing (`stepPace`, `layerPace`, `BEAT`)                                                |
| `selectors.ts`      | `kvCacheLength`, `embeddedCount`, `emittedTokens`, `visibleAttention`                            |
| `sim.test.ts`       | 22 tests incl. KV-cache ≡ full recompute                                                         |

Everything is deterministic: seeded `mulberry32`, no `Math.random`, no `Date`.

## Your job

1. Keep every claim accurate (S1): review `src/content/*` and timeline labels.
2. Make arbitrary prompts behave (S2).
3. Build the path to **real** data (S3, S5): an offline exporter producing `InferenceTrace` JSON
   from GPT-2 small with `provenance: 'recorded'`. Suggested: TransformerLens
   `run_with_cache`, pattern hooks `blocks.{l}.attn.hook_pattern`, greedy or seeded sampling, top-32
   logits per step, real token IDs/strings. GPT-2 uses learned absolute positions, LayerNorm,
   GELU, so set `ModelConfig` accordingly; the UI copy must adapt to `positionEncoding`.
4. Expose more computed internals as optional trace fields (S4 Q/K/V previews, S7 cache
   counterfactuals) for Graphics/UX to visualize.

## Start here

★ **S1 Accuracy review**, then **S2**. For S2, a quick win: expand `corpus.ts` with ~50 more
sentences spanning common prompt openers, and add a backoff that prefers frequent continuation
words over punctuation when tri/bigram contexts are missing. Add a test that 10 assorted prompts
yield ≥ 3 word tokens before EOS.

## Guardrails

- `src/sim` must not import React, Three, or anything from `scene/ui/state`.
- Contract changes are additive (optional fields) unless the Architect agrees otherwise.
- If a visualization needs a number, compute it here, test it, and give it a provenance.
- When in doubt about a claim, weaken the claim and state the limitation.
