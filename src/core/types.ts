/**
 * Shared contracts. Every module (sim, scene, ui, content) depends on this file;
 * nothing here depends on React or Three.js. Owner: Architect. See docs/INTERFACES.md.
 */

/**
 * Where a piece of data came from. Every number shown to a user must carry one.
 * - computed:     produced by real arithmetic in this app (e.g. softmax over real logits,
 *                 attention of the toy transformer).
 * - illustrative: hand-authored or heuristic stand-ins chosen to explain a concept
 *                 (e.g. the toy tokenizer's token IDs, n-gram next-token scores).
 * - recorded:     captured from a real model run offline (future: GPT-2 trace import).
 */
export type Provenance = 'computed' | 'illustrative' | 'recorded';

/** Macro-scale facilities in the world, in pipeline order. */
export type StationId =
  'input' | 'tokenizer' | 'embedding' | 'transformer' | 'lmHead' | 'sampler' | 'output';

export const STATION_ORDER: readonly StationId[] = [
  'input',
  'tokenizer',
  'embedding',
  'transformer',
  'lmHead',
  'sampler',
  'output',
];

/** Sub-operations inside one Transformer block (pre-norm ordering, see ModelConfig.normPlacement). */
export type BlockOp = 'norm1' | 'attention' | 'residual1' | 'norm2' | 'mlp' | 'residual2';

export const BLOCK_OP_ORDER: readonly BlockOp[] = [
  'norm1',
  'attention',
  'residual1',
  'norm2',
  'mlp',
  'residual2',
];

export interface ModelConfig {
  name: string;
  nLayers: number;
  nHeads: number;
  dModel: number;
  dHead: number;
  dMlp: number;
  /** Vocabulary size the token IDs are drawn from (display / realism only for the toy model). */
  vocabSize: number;
  maxContext: number;
  positionEncoding: 'rope' | 'learned-absolute';
  normPlacement: 'pre' | 'post';
  normType: 'rmsnorm' | 'layernorm';
  mlpActivation: 'gelu' | 'swiglu';
}

export interface SamplingConfig {
  /** 0 => greedy (argmax). */
  temperature: number;
  /** 0 => disabled. */
  topK: number;
  /** 1 => disabled. */
  topP: number;
  maxNewTokens: number;
  /** End-of-text is masked out until this many tokens exist (like HF `min_new_tokens`). */
  minNewTokens: number;
  seed: number;
}

export interface Token {
  /** Position in the full sequence (prompt + generated). */
  position: number;
  id: number;
  /** Surface text including any leading space, e.g. " machine". */
  text: string;
  source: 'prompt' | 'generated';
  /** True for the special end-of-sequence token. */
  special?: boolean;
}

export interface Candidate {
  id: number;
  text: string;
  logit: number;
  /** Probability under the *final* sampling distribution (after temperature/top-k/top-p). */
  prob: number;
  /** Probability under plain softmax(logits), temperature 1, no filtering. */
  rawProb: number;
  /** False if removed by top-k or top-p. */
  kept: boolean;
}

export interface LogitsTrace {
  /** Top candidates, sorted by logit descending. The full vocab is never shipped to the UI. */
  candidates: Candidate[];
  provenance: Provenance;
}

export interface HeadAttention {
  head: number;
  /**
   * Rows = query positions processed in this step (`GenerationStep.queryPositions`),
   * cols = key positions 0..contextLength-1. Causally masked entries are exactly 0.
   */
  weights: number[][];
}

export interface LayerTrace {
  layer: number;
  heads: HeadAttention[];
  /** L2 norm of the residual stream after this layer, per query position (for glow intensity). */
  residualNorms: number[];
  /** L2 norm of the attention and MLP writes into the residual stream, per query position. */
  attnWriteNorms: number[];
  mlpWriteNorms: number[];
  provenance: Provenance;
}

export interface GenerationStep {
  index: number;
  /** prefill = all prompt tokens in parallel; decode = one new token using the KV cache. */
  phase: 'prefill' | 'decode';
  /** Positions whose representations are computed in this step. */
  queryPositions: number[];
  /** Number of key/value positions attended to (= cache size after this step). */
  contextLength: number;
  /** Cache entries per layer *before* this step ran (0 for prefill). */
  kvCacheBefore: number;
  layers: LayerTrace[];
  logits: LogitsTrace;
  /** Token chosen at the end of this step (appended at position contextLength). */
  sampled: Token;
  /** Set on the final step. */
  stopReason?: 'eos' | 'maxTokens' | 'contextFull';
}

export interface EmbeddingTrace {
  position: number;
  /** Small slice of the embedding vector, for visualization. */
  preview: number[];
  provenance: Provenance;
}

/**
 * The complete, self-contained record of one inference run. The scene and UI only read
 * this structure — they never call the simulator. A recorded trace from a real model can
 * replace a simulated one as long as it satisfies this shape.
 */
export interface InferenceTrace {
  version: 1;
  prompt: string;
  model: ModelConfig;
  sampling: SamplingConfig;
  /** prompt tokens followed by generated tokens (EOS included if generated). */
  tokens: Token[];
  promptLength: number;
  embeddings: EmbeddingTrace[];
  steps: GenerationStep[];
  outputText: string;
  provenance: {
    tokenizer: Provenance;
    transformer: Provenance;
    logits: Provenance;
    sampling: Provenance;
  };
}

// ---------------------------------------------------------------------------
// Timeline: the trace flattened into timed, typed events for playback.
// ---------------------------------------------------------------------------

export type SimEventKind =
  | 'prompt.received'
  | 'tokenize'
  | 'embed'
  | 'block.norm'
  | 'block.attention'
  | 'block.residual'
  | 'block.mlp'
  | 'lmHead.project'
  | 'sample.select'
  | 'detokenize.emit'
  | 'generation.stop';

/**
 * A single visual beat. Events reference trace data by index (step, layer, positions)
 * instead of copying it, so consumers look details up in the trace.
 */
export interface SimEvent {
  /** Stable, unique id, e.g. "s0.l2.attention". */
  id: string;
  kind: SimEventKind;
  station: StationId;
  step: number;
  layer?: number;
  op?: BlockOp;
  /** Token positions this event operates on. */
  positions: number[];
  /** Seconds from timeline start (at speed 1). */
  start: number;
  duration: number;
  /** Short caption, e.g. "Layer 2 · attention: 6 queries × 6 keys". */
  label: string;
}

export interface Timeline {
  events: SimEvent[];
  duration: number;
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

export type FocusTarget =
  | { kind: 'overview' }
  | { kind: 'station'; station: StationId }
  | { kind: 'layer'; layer: number; op?: BlockOp };

export type AppMode = 'guided' | 'explore';
