import type { Candidate, SamplingConfig } from '@/core/types';
import { softmax } from './math';
import type { TokenPiece } from './tokenizer';

export interface SamplingDistribution {
  /** softmax(logits) at temperature 1, no filtering. */
  rawProbs: number[];
  /** Final distribution actually sampled from. */
  probs: number[];
  kept: boolean[];
}

/**
 * Applies decoding transforms in the conventional order (as in Hugging Face `generate`):
 * temperature scaling, then top-k, then top-p (nucleus) on the renormalized result.
 * temperature <= 0 means greedy decoding (one-hot on the argmax).
 */
export function samplingDistribution(
  logits: readonly number[],
  cfg: Pick<SamplingConfig, 'temperature' | 'topK' | 'topP'>,
): SamplingDistribution {
  const rawProbs = softmax([...logits]);
  const order = logits.map((_, i) => i).sort((a, b) => logits[b]! - logits[a]!);
  const kept = logits.map(() => false);

  if (cfg.temperature <= 0) {
    const best = order[0];
    const probs = logits.map(() => 0);
    if (best !== undefined) {
      probs[best] = 1;
      kept[best] = true;
    }
    return { rawProbs, probs, kept };
  }

  const scaled = logits.map((l) => l / cfg.temperature);
  let candidates = cfg.topK > 0 ? order.slice(0, cfg.topK) : order;

  if (cfg.topP < 1) {
    const p = softmax(candidates.map((i) => scaled[i]!));
    let cumulative = 0;
    let cut = candidates.length;
    for (let r = 0; r < p.length; r++) {
      cumulative += p[r]!;
      if (cumulative >= cfg.topP) {
        cut = r + 1;
        break;
      }
    }
    candidates = candidates.slice(0, Math.max(1, cut));
  }

  for (const i of candidates) kept[i] = true;
  const probs = softmax(scaled.map((s, i) => (kept[i] ? s : -Infinity)));
  return { rawProbs, probs, kept };
}

/** Inverse-CDF sampling with a caller-provided uniform random number in [0, 1). */
export function sampleIndex(probs: readonly number[], u: number): number {
  let cumulative = 0;
  let last = 0;
  for (let i = 0; i < probs.length; i++) {
    const p = probs[i]!;
    if (p <= 0) continue;
    last = i;
    cumulative += p;
    if (u < cumulative) return i;
  }
  return last;
}

export function topCandidates(
  vocab: readonly TokenPiece[],
  logits: readonly number[],
  dist: SamplingDistribution,
  n: number,
  mustInclude?: number,
): Candidate[] {
  const order = logits.map((_, i) => i).sort((a, b) => logits[b]! - logits[a]!);
  const chosen = order.slice(0, n);
  if (mustInclude !== undefined && !chosen.includes(mustInclude)) chosen[n - 1] = mustInclude;
  return chosen.map((i) => ({
    id: vocab[i]!.id,
    text: vocab[i]!.text,
    logit: logits[i]!,
    prob: dist.probs[i]!,
    rawProb: dist.rawProbs[i]!,
    kept: dist.kept[i]!,
  }));
}
