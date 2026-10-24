/** Public API of the simulation module. Other modules import from '@/sim' only. */
export { buildTrace, attentionMatrix, TraceError, type BuildTraceOptions } from './trace';
export { buildTimeline } from './timeline';
export {
  eventIndexAt,
  eventProgress,
  nextBoundary,
  prevBoundary,
  clampTime,
  easeInOut,
} from './playback';
export {
  kvCacheLength,
  emittedTokens,
  promptTokenized,
  embeddedCount,
  visibleAttention,
  type VisibleAttention,
} from './selectors';
export { samplingDistribution, sampleIndex } from './sampling';
export { toyTokenizer, type Tokenizer, type TokenPiece } from './tokenizer';
export { softmax } from './math';
export { mulberry32 } from './random';
