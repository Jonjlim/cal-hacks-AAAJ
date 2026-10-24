import { BLOCK_OP_ORDER, type InferenceTrace, type SimEvent, type Token } from '@/core/types';
import { attentionMatrix } from './trace';

const ATTENTION_ORDER = BLOCK_OP_ORDER.indexOf('attention');

/** Number of K/V entries stored in `layer`'s cache while `event` plays. */
export function kvCacheLength(trace: InferenceTrace, event: SimEvent, layer: number): number {
  const step = trace.steps[event.step];
  if (!step) return 0;
  switch (event.kind) {
    case 'prompt.received':
    case 'tokenize':
    case 'embed':
      return step.kvCacheBefore;
    case 'lmHead.project':
    case 'sample.select':
    case 'detokenize.emit':
    case 'generation.stop':
      return step.contextLength;
    default: {
      const l = event.layer ?? 0;
      if (l !== layer) return l > layer ? step.contextLength : step.kvCacheBefore;
      const opIndex = event.op ? BLOCK_OP_ORDER.indexOf(event.op) : 0;
      return opIndex >= ATTENTION_ORDER ? step.contextLength : step.kvCacheBefore;
    }
  }
}

export interface VisibleAttention {
  /** rows[i][j]: weight of query i on key j, zero-padded to a square matrix. */
  rows: number[][];
  /** Query positions computed in the current step (highlighted). */
  currentRows: number[];
}

/**
 * Attention matrix for one layer/head as it exists while `event` plays: the current step's
 * rows are included only once that layer has actually run attention.
 */
export function visibleAttention(
  trace: InferenceTrace,
  event: SimEvent,
  layer: number,
  head: number,
): VisibleAttention | null {
  const step = trace.steps[event.step];
  if (!step) return null;
  const done = kvCacheLength(trace, event, layer) === step.contextLength;
  const through = done ? event.step : event.step - 1;
  if (through < 0) return null;
  return {
    rows: attentionMatrix(trace, layer, head, through),
    currentRows: done ? step.queryPositions : [],
  };
}

/** Generated tokens already decoded into visible output text while `event` plays. */
export function emittedTokens(trace: InferenceTrace, event: SimEvent): Token[] {
  const done =
    event.step + (event.kind === 'detokenize.emit' || event.kind === 'generation.stop' ? 1 : 0);
  return trace.steps.slice(0, done).map((s) => s.sampled);
}

/** Whether the prompt has been split into tokens yet. */
export function promptTokenized(event: SimEvent): boolean {
  return !(event.step === 0 && event.kind === 'prompt.received');
}

/** Positions whose embedding has been looked up while `event` plays. */
export function embeddedCount(trace: InferenceTrace, event: SimEvent): number {
  const step = trace.steps[event.step];
  if (!step) return 0;
  const before = event.kind === 'prompt.received' || event.kind === 'tokenize';
  return before ? step.kvCacheBefore : step.contextLength;
}
