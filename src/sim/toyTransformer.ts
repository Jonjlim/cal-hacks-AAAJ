import type { ModelConfig } from '@/core/types';
import {
  add,
  applyRope,
  dot,
  gelu,
  norm,
  rmsNorm,
  softmax,
  vecMat,
  type Mat,
  type Vec,
} from './math';
import { gaussian, mulberry32 } from './random';

/**
 * A genuinely computed, tiny pre-norm decoder-only Transformer with random weights.
 * Its arithmetic is real (RMSNorm, RoPE on Q/K, causal multi-head attention with a KV
 * cache, GELU MLP, residual adds), so attention patterns and cache behavior are faithful.
 * Its weights are untrained, so its outputs carry no meaning.
 */

interface LayerWeights {
  wq: Mat;
  wk: Mat;
  wv: Mat;
  wo: Mat;
  w1: Mat;
  w2: Mat;
}

export interface ToyWeights {
  layers: LayerWeights[];
}

/** Sharpens Q·K so random-weight attention patterns are visibly structured instead of near-uniform. */
const QK_GAIN = 2.2;

function randomMat(rows: number, cols: number, std: number, rand: () => number): Mat {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => gaussian(rand) * std),
  );
}

export function createToyWeights(cfg: ModelConfig, seed = 7): ToyWeights {
  const rand = mulberry32(seed);
  const d = cfg.dModel;
  const std = 1 / Math.sqrt(d);
  return {
    layers: Array.from({ length: cfg.nLayers }, () => ({
      wq: randomMat(d, d, std * QK_GAIN, rand),
      wk: randomMat(d, d, std * QK_GAIN, rand),
      wv: randomMat(d, d, std, rand),
      wo: randomMat(d, d, std, rand),
      w1: randomMat(d, cfg.dMlp, std, rand),
      w2: randomMat(cfg.dMlp, d, 1 / Math.sqrt(cfg.dMlp), rand),
    })),
  };
}

/** Embedding "lookup": a fixed pseudo-random vector per token ID (stands in for a learned table row). */
export function embedToken(id: number, cfg: ModelConfig): Vec {
  const rand = mulberry32(id * 2654435761);
  return Array.from({ length: cfg.dModel }, () => gaussian(rand));
}

export interface KVCache {
  /** keys[layer][head][position] => dHead vector (RoPE already applied). */
  keys: Vec[][][];
  values: Vec[][][];
}

export function createKVCache(cfg: ModelConfig): KVCache {
  const make = () =>
    Array.from({ length: cfg.nLayers }, () =>
      Array.from({ length: cfg.nHeads }, () => [] as Vec[]),
    );
  return { keys: make(), values: make() };
}

export function cacheLength(cache: KVCache): number {
  return cache.keys[0]?.[0]?.length ?? 0;
}

export interface LayerForward {
  /** heads[h][row][col]: rows = batch positions, cols = 0..contextLength-1. */
  heads: number[][][];
  residualNorms: number[];
  attnWriteNorms: number[];
  mlpWriteNorms: number[];
}

export interface ForwardResult {
  hidden: Vec[];
  layers: LayerForward[];
  contextLength: number;
}

/**
 * Runs `inputs` (embeddings for positions startPos..startPos+B-1) through every layer,
 * appending their keys/values to `cache`. Prefill passes the whole prompt at once;
 * decode passes one token. Both produce identical numbers for the same positions.
 */
export function forward(
  weights: ToyWeights,
  cfg: ModelConfig,
  inputs: readonly Vec[],
  cache: KVCache,
): ForwardResult {
  const startPos = cacheLength(cache);
  const contextLength = startPos + inputs.length;
  const dh = cfg.dHead;
  const scale = 1 / Math.sqrt(dh);
  let xs = inputs.map((x) => x.slice());
  const layers: LayerForward[] = [];

  weights.layers.forEach((w, l) => {
    const normed = xs.map((x) => rmsNorm(x));
    const qFull = normed.map((x) => vecMat(x, w.wq));
    const kFull = normed.map((x) => vecMat(x, w.wk));
    const vFull = normed.map((x) => vecMat(x, w.wv));

    const heads: number[][][] = [];
    const headOuts: Vec[][] = xs.map(() => []);

    for (let h = 0; h < cfg.nHeads; h++) {
      const slice = (v: Vec) => v.slice(h * dh, (h + 1) * dh);
      const keyCache = cache.keys[l]![h]!;
      const valueCache = cache.values[l]![h]!;
      xs.forEach((_, b) => {
        keyCache.push(applyRope(slice(kFull[b]!), startPos + b));
        valueCache.push(slice(vFull[b]!));
      });

      const rows: number[][] = [];
      xs.forEach((_, b) => {
        const pos = startPos + b;
        const q = applyRope(slice(qFull[b]!), pos);
        // Causal mask: a query at position `pos` may only see keys 0..pos.
        const scores = keyCache.map((k, j) => (j <= pos ? scale * dot(q, k) : -Infinity));
        const row = softmax(scores);
        rows.push(row);
        const out = new Array<number>(dh).fill(0);
        row.forEach((wj, j) => {
          if (wj === 0) return;
          const v = valueCache[j]!;
          for (let i = 0; i < dh; i++) out[i]! += wj * v[i]!;
        });
        headOuts[b]!.push(out);
      });
      heads.push(rows);
    }

    const attnWrites = headOuts.map((parts) => vecMat(parts.flat(), w.wo));
    xs = xs.map((x, b) => add(x, attnWrites[b]!));
    const mlpWrites = xs.map((x) => vecMat(vecMat(rmsNorm(x), w.w1).map(gelu), w.w2));
    xs = xs.map((x, b) => add(x, mlpWrites[b]!));

    layers.push({
      heads,
      residualNorms: xs.map(norm),
      attnWriteNorms: attnWrites.map(norm),
      mlpWriteNorms: mlpWrites.map(norm),
    });
  });

  return { hidden: xs.map((x) => rmsNorm(x)), layers, contextLength };
}
