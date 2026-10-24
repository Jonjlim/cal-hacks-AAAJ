# The LLM Inference Pipeline, and How We Show It

Owner: LLM Simulation. This is the scientific reference for the project. Any copy in
`src/content` must be consistent with it.

Scope: **inference** in a **decoder-only Transformer** (GPT-style). Training is out of scope.

## What is real in this app

| Part                            | Status           | Detail                                                                                                                                               |
| ------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prompt text                     | real             | what the user typed                                                                                                                                  |
| Tokenizer                       | **illustrative** | BPE-like splits (leading spaces, subwords, punctuation); hand-made rules, hashed IDs. Not GPT-2's vocabulary                                         |
| Embedding lookup                | computed (toy)   | 16-dim pseudo-random row per ID (stands in for a learned table)                                                                                      |
| Transformer blocks              | **computed**     | Real arithmetic: RMSNorm, Q/K/V projections, RoPE, causal multi-head attention, KV cache, output projection, GELU MLP, residual adds. Random weights |
| Attention weights shown         | **computed**     | Exactly the softmax weights of that toy model                                                                                                        |
| LM-head logits                  | **illustrative** | Interpolated trigram over a ~20-sentence corpus (`src/sim/corpus.ts`), so output is readable                                                         |
| Temperature / top-k / top-p     | **computed**     | Applied exactly to those logits; seeded RNG                                                                                                          |
| Prefill/decode, KV cache, stops | **computed**     | Real control flow                                                                                                                                    |
| Detokenization                  | computed         | concatenation of token strings                                                                                                                       |

**Why the split?** An untrained toy Transformer has faithful _mechanics_ but meaningless
_semantics_; its own LM head would emit gibberish. A trained model small enough to run and fully
expose in the browser isn't feasible for P0. So mechanics come from the toy model and readability
comes from a transparent stand-in, and we say so in the UI. The P1 path to fully real data is
recorded GPT-2 traces (see ARCHITECTURE.md).

**We never claim** to show what the model "thinks", "understands", or "means". Attention weights
describe how information is mixed. They are not explanations of reasoning.

---

## Stage-by-stage

### 1. Input

Text prompt. (Chat products add templates and system prompts first. We skip that.)

**World:** `InputTerminal`, a wireframe screen holding the raw string, which dissolves as
tokenization starts.

### 2. Tokenization

Text → sequence of token IDs from a fixed vocabulary (GPT-2: 50,257 BPE tokens; newer models
100k–200k+). Leading spaces are usually part of the token. Happens **once** for the prompt;
sampled tokens are already IDs.

**World:** `TokenizerGate`, a rotating cutter ring. The string flies in; token packets fly out and
spread onto their own lanes. Each lane gets a label with the token text and ID.
**Abstraction:** illustrative tokenizer; IDs are not real GPT-2 IDs (badge says so).

### 3. Embeddings and position

Each ID selects a row of the embedding matrix `E (vocab × d_model)`: `x₀ = E[id]`.

Position information **depends on architecture**:

- GPT-2: a learned position vector is **added** to `x₀` here.
- RoPE models (LLaMA, Mistral, Qwen, and our toy model): nothing is added here; queries and keys are
  **rotated** inside every attention layer by a position-dependent angle, so `q·k` depends on
  relative distance.

**World:** `EmbeddingTable`, a tall table with row lines. A cursor slides to the looked-up row; the
token leaves as a small bar chart of its first 8 numbers (positive = green, negative = blue).
**Abstraction:** we show 8 of 16 dims; real models use 768–8192+.

### 4. Transformer blocks: the residual stream

The vector for each position flows along its own **lane**: the residual stream. Each block reads
from the stream and **adds** an update back. Nothing replaces it.

Our toy model (and most modern LLMs) uses **pre-norm** ordering:

```
x ← x + Attention(Norm(x))
x ← x + MLP(Norm(x))
```

The original Transformer / BERT use **post-norm** (`x ← Norm(x + Sublayer(x))`). Some models use
parallel attention+MLP (GPT-J). The UI states that our ordering is one common choice, not universal.
`ModelConfig.normPlacement` records which one a trace uses.

**World:** straight glowing lanes from embedding to LM head, through 4 `LayerBlock`s.

#### 4A. Normalization

RMSNorm: `x / √(mean(x²)+ε) ⊙ g` (LayerNorm also subtracts the mean). Per position, with no mixing.
**World:** thin rectangular gates the lanes pass through; they flash during `block.norm`.

#### 4B. Attention preparation

`Q = xW_Q, K = xW_K, V = xW_V`, split into `n_heads` heads of size `d_head`; RoPE rotates Q and K.

#### 4C. Causal multi-head self-attention

For each head: `A = softmax(QKᵀ/√d_head + M)`, where `M_ij = −∞` for `j > i` (causal mask), then
`out_h = A V`. Heads are concatenated and projected: `out = concat(out_h) W_O`.

Key distinctions we make visible:

- **Attention weights** (the matrix `A`) say _how much_ to mix; the **output** is a weighted sum of
  **value** vectors added to the stream. Different objects.
- Attention is the **only** operation that moves information between positions.
- Causality: arcs only go from earlier lanes to later ones; the matrix's upper triangle is dark.
- Multiple heads = multiple independent mixing patterns.

**World:**

- Macro: one translucent arch per head spans the lanes. During `block.attention`, arcs of light
  connect each key lane to each query lane; brightness is the weight (`AttentionArcs`).
- Micro (deep dive): `AttentionMatrix` stands above the layer, with each key column directly over
  its lane, rows as queries, extrusion and brightness as weight, and the masked triangle dark. The
  `AttentionInspector` panel lists exact weights for a chosen head and query.

**Abstraction:** weights are computed from random weights, so patterns show mechanics, not language
structure. Q/K/V vectors themselves are not yet drawn (P1).

#### 4D. Residual add

`x ← x + attn_out`. **World:** octahedral nodes on each lane flash.

#### 4E. Feed-forward / MLP

`MLP(x) = GELU(xW₁)W₂`, typically 4× expansion (toy: 16→64→16); many modern models use SwiGLU.
**Per position**, with no mixing. Most parameters live here.
**World:** a tower on each lane (separate towers = no mixing), growing with the update's size
(`mlpWriteNorms`).

### 5. Output projection (LM head)

Final norm, then `logits = h_last · W_U (d_model × vocab)`, often tied to `E`. During generation
only the **last position's** logits are needed. Logits are unnormalized scores **for the next token
only**, not the response.

**World:** `LmHead`. Packets converge to the center line (only the last position continues) and a
fan of rays spreads out ("one vector in, one score per vocabulary entry out").
**Abstraction:** logits come from the n-gram stand-in (badged **Illustrative**).

### 6. Next-token selection

`p = softmax(logits / T)`; then top-k keeps the k best, top-p keeps the smallest prefix with mass
≥ p; renormalize; sample. `T = 0` ⇒ greedy argmax. We follow the Hugging Face order
(temperature → top-k → top-p). `min_new_tokens` masks EOS early.

**World:** `Sampler`, a row of pillars. Wireframe ghost = plain softmax, solid = final sampling
distribution, collapsed = filtered out, pink = chosen. The **Sampling Lab** sliders reshape the
pillars live (preview over the top-32 candidates); "Re-run" regenerates the whole response.

### 7. Autoregressive generation

- **Prefill**: all prompt positions run through every layer **in parallel**; K/V for each layer
  are stored in the **KV cache**.
- **Decode**: the sampled token is appended and **only that one position** runs through the
  layers. Its query attends to all cached keys plus its own. Each step adds one row to the
  attention matrix and one tile per layer to the cache.
- The prompt is **not** recomputed each step. (Without a cache it would be; that is the
  quadratic cost caching avoids.)
- Stop conditions: EOS token, max new tokens, context window full (also stop strings in real
  systems).

**World:** the pink `AutoregressiveLoop` arc carries the new token from output back to the
embedding table; `KVCacheTiles` sit under each layer's arches (stored = dim, new = bright); the
caption reads `DECODE n · KV cache a → b`. Later decode steps are fast-forwarded (pacing only; the
data is identical).

### 8. Detokenization

Token IDs → strings, concatenated (real tokenizers handle byte-level merges). Streams one token
at a time. **World:** `OutputScreen` plus the token strip in the HUD.

---

## Known simplifications (keep this list honest)

1. 4 layers / 4 heads / d_model 16, versus 12–100+ layers and thousands of dims in real models.
2. Random weights, so attention patterns are not linguistically meaningful.
3. Illustrative tokenizer and n-gram logits (see table above).
4. No batching, no chat template, no positional interpolation, no speculative decoding.
5. Norm gains fixed to 1; no biases.
6. The visual "packet" for a position is a metaphor for its vector; vectors don't travel anywhere
   physically.
7. Timeline pacing compresses later steps; it doesn't reflect real latency.

## Validation

- `src/sim/sim.test.ts`: causality, normalization, KV-cache equivalence, determinism, sampling
  semantics, timeline integrity.
- Before demo: Sim owner reviews every `src/content` string against this doc.
