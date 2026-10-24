# Interfaces & Contracts

These contracts let four people work in parallel. Source of truth: `src/core/types.ts`,
`src/sim/index.ts`, `src/state/index.ts`. If this doc and the code disagree, the code wins and
this doc gets fixed in the same PR.

## Change protocol

- **Additive changes** (new optional field, new event kind, new selector) → normal PR, tag the
  Architect.
- **Breaking changes** (rename/remove/semantics change) → announce in team chat first, Architect +
  every affected owner approves, land in a dedicated small PR, then everyone rebases.
- New `SimEventKind`s must be handled (or explicitly ignored) by `focusForEvent`, `TokenPackets`,
  and `Caption`. Add a test in `sim.test.ts`.

## 1. Inference trace (sim → everyone)

```ts
type Provenance = 'computed' | 'illustrative' | 'recorded';

interface InferenceTrace {
  version: 1;
  prompt: string;
  model: ModelConfig; // nLayers, nHeads, dModel, dHead, dMlp, vocabSize, maxContext, positionEncoding, normPlacement, normType, mlpActivation
  sampling: SamplingConfig; // temperature, topK, topP, maxNewTokens, minNewTokens, seed
  tokens: Token[]; // prompt tokens then generated tokens (EOS included if generated)
  promptLength: number;
  embeddings: EmbeddingTrace[]; // per position: first 8 dims of the embedding
  steps: GenerationStep[]; // [prefill, decode, decode, ...]
  outputText: string;
  provenance: { tokenizer; transformer; logits; sampling: Provenance };
}

interface GenerationStep {
  index: number;
  phase: 'prefill' | 'decode';
  queryPositions: number[]; // prefill: all prompt positions; decode: [newPosition]
  contextLength: number; // keys attended (= KV cache size after this step)
  kvCacheBefore: number; // 0 for prefill
  layers: LayerTrace[]; // per layer: heads[h].weights[row][col], residual/attn/mlp write norms
  logits: { candidates: Candidate[]; provenance }; // top 32, sorted by logit desc
  sampled: Token; // token chosen at the end of this step
  stopReason?: 'eos' | 'maxTokens' | 'contextFull';
}
```

Invariants (tested in `src/sim/sim.test.ts`):

- Deterministic: same `(prompt, sampling)` ⇒ deep-equal trace.
- `weights[row]` sums to 1; entries with `col > queryPositions[row]` are exactly 0.
- Decode steps have exactly one query; `kvCacheBefore === contextLength - 1`.
- KV-cached decode equals full recomputation (to 1e-10).
- `tokenizer.decode(tokenizer.encode(s)) === s`.
- Last step has `stopReason`.

## 2. Timeline (sim → scene/ui)

```ts
interface SimEvent {
  id: string; // "s{step}.l{layer}.{op}" | "s{step}.{kind}"
  kind: SimEventKind; // prompt.received | tokenize | embed | block.norm | block.attention |
  //                     block.residual | block.mlp | lmHead.project | sample.select |
  //                     detokenize.emit | generation.stop
  station: StationId; // input | tokenizer | embedding | transformer | lmHead | sampler | output
  step: number;
  layer?: number;
  op?: BlockOp; // norm1 | attention | residual1 | norm2 | mlp | residual2
  positions: number[]; // token positions operated on
  start: number;
  duration: number; // seconds at 1× speed
  label: string; // caption text
}
interface Timeline {
  events: SimEvent[];
  duration: number;
}
```

Events are **sequential and contiguous** (no overlap). Consumers look data up in the trace using
`step`, `layer`, `positions`; events never copy numbers.

## 3. Sim public API (`@/sim`)

| Function                                             | Purpose                                         |
| ---------------------------------------------------- | ----------------------------------------------- |
| `buildTrace({prompt, sampling, model?, tokenizer?})` | Run the simulation. Throws `TraceError`         |
| `buildTimeline(trace)`                               | Flatten to events                               |
| `eventIndexAt(tl, t)`, `eventProgress(e, t)`         | Time lookup                                     |
| `nextBoundary`, `prevBoundary`, `clampTime`          | Stepping                                        |
| `easeInOut(x)`                                       | Shared easing                                   |
| `kvCacheLength(trace, event, layer)`                 | Cache size of a layer while `event` plays       |
| `embeddedCount(trace, event)`                        | Positions that exist (lanes lit)                |
| `emittedTokens(trace, event)`                        | Generated tokens already decoded to text        |
| `promptTokenized(event)`                             | Has the prompt been split yet                   |
| `visibleAttention(trace, event, layer, head)`        | Matrix rows computed so far + current rows      |
| `attentionMatrix(trace, layer, head, throughStep)`   | Full padded matrix                              |
| `samplingDistribution(logits, cfg)`                  | Raw/final probs + kept mask (for labs/previews) |
| `toyTokenizer`, `Tokenizer`                          | Tokenizer interface for swapping in real BPE    |

## 4. State API (`@/state`)

```ts
useAppStore: {
  mode, focus, introOpen, prompt, sampling, trace, timeline, error,
  attentionHead, quality, samplingDraft,
  run(prompt?, samplingPatch?): boolean, focusOn(target), setMode(mode),
  setAttentionHead(h), setSamplingDraft(d | null), setQuality(q), closeIntro()
}
usePlaybackStore: { playing, speed, eventIndex,
  play(), pause(), toggle(), setSpeed(s), seek(t), stepForward(), stepBack(), reset() }
clock: { time }                 // read-only outside PlaybackDriver and seek()
useCurrentEvent(): SimEvent | undefined
useResolvedFocus(): FocusTarget  // guided ⇒ focusForEvent(event); explore ⇒ focus
```

`FocusTarget = {kind:'overview'} | {kind:'station', station} | {kind:'layer', layer, op?}`

## 5. Scene contracts

- `scene/hooks.ts → useSimFrame(cb)`: the only sanctioned way to animate from sim time.
  Callback gets `{ t, index, event, progress, trace, timeline, delta, elapsed }`.
- `scene/layout.ts`: `STATION_X`, `layerX`, `opX`, `laneZ`, `eventAnchorX`, `loopPoint`,
  `cameraPoseFor`. Any new station gets an x slot here first.
- Stations wrap content in `<StationShell station x label>` for click-to-focus, hover, active glow.

## 6. Content contract (`src/content/stations.ts`)

```ts
interface Explainer {
  title;
  kicker;
  summary; // beginner, 1–2 sentences
  details: string[]; // technical bullets
  math?: string[]; // plain-text formulas
  honesty: string; // what is real here
  provenance: Provenance;
}
STATION_CONTENT: Record<StationId, Explainer>;
BLOCK_OP_CONTENT: Record<BlockOp, Explainer>;
```

## 7. Mocking unfinished work

- Need data that doesn't exist yet? Add an **optional** field to the trace, fill it with an
  `illustrative` placeholder in `buildTrace`, and render it. Swap to computed later.
- Need a station that isn't built? Use `<StationShell>` with a wireframe box placeholder so camera,
  nav, and inspector work immediately.
- Need UI for a feature with no data? Gate it on the field's presence (`trace.x ? <Panel/> : null`).
