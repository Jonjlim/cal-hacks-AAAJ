import { MAX_PROMPT_TOKENS, TOY_MODEL } from '@/core/config';
import type {
  GenerationStep,
  InferenceTrace,
  LayerTrace,
  ModelConfig,
  SamplingConfig,
  Token,
} from '@/core/types';
import { buildNgramModel, type NextTokenModel } from './ngram';
import { hashString, mulberry32 } from './random';
import { sampleIndex, samplingDistribution, topCandidates } from './sampling';
import { toyTokenizer, type Tokenizer } from './tokenizer';
import {
  createKVCache,
  createToyWeights,
  embedToken,
  forward,
  type ForwardResult,
  type ToyWeights,
} from './toyTransformer';

export interface BuildTraceOptions {
  prompt: string;
  sampling: SamplingConfig;
  model?: ModelConfig;
  tokenizer?: Tokenizer;
  nextToken?: NextTokenModel;
}

export class TraceError extends Error {}

/** Enough candidates for the sampling lab to preview settings faithfully. */
const CANDIDATES_SHOWN = 32;
const EMBED_PREVIEW = 8;

let cachedNgram: NextTokenModel | undefined;
const weightCache = new Map<string, ToyWeights>();

function weightsFor(model: ModelConfig): ToyWeights {
  let w = weightCache.get(model.name);
  if (!w) weightCache.set(model.name, (w = createToyWeights(model)));
  return w;
}

function toLayerTraces(result: ForwardResult): LayerTrace[] {
  return result.layers.map((l, layer) => ({
    layer,
    heads: l.heads.map((weights, head) => ({ head, weights })),
    residualNorms: l.residualNorms,
    attnWriteNorms: l.attnWriteNorms,
    mlpWriteNorms: l.mlpWriteNorms,
    provenance: 'computed',
  }));
}

/**
 * Runs the full deterministic simulation: tokenize, prefill, then decode token by token
 * with a KV cache until EOS, the token budget, or the context limit.
 * Same inputs always yield an identical trace.
 */
export function buildTrace(opts: BuildTraceOptions): InferenceTrace {
  const model = opts.model ?? TOY_MODEL;
  const tokenizer = opts.tokenizer ?? toyTokenizer;
  const nextToken = opts.nextToken ?? (cachedNgram ??= buildNgramModel());
  const { sampling } = opts;

  const prompt = opts.prompt.replace(/\s+$/u, '');
  if (prompt.trim().length === 0) throw new TraceError('Type a prompt first.');

  const pieces = tokenizer.encode(prompt);
  if (pieces.length > MAX_PROMPT_TOKENS) {
    throw new TraceError(
      `That prompt is ${pieces.length} tokens; the demo supports up to ${MAX_PROMPT_TOKENS}.`,
    );
  }

  const tokens: Token[] = pieces.map((p, position) => ({ ...p, position, source: 'prompt' }));
  const promptLength = tokens.length;
  const maxNew = Math.max(1, Math.min(sampling.maxNewTokens, model.maxContext - promptLength));
  const weights = weightsFor(model);
  const cache = createKVCache(model);
  const rand = mulberry32(sampling.seed ^ hashString(prompt));
  const steps: GenerationStep[] = [];

  let inputs = tokens.map((t) => embedToken(t.id, model));
  let queryPositions = tokens.map((t) => t.position);

  for (let index = 0; ; index++) {
    const kvCacheBefore = queryPositions[0]!;
    const result = forward(weights, model, inputs, cache);

    const logits = nextToken.logits(tokens.map((t) => t.text));
    if (tokens.length - promptLength < sampling.minNewTokens) {
      nextToken.vocab.forEach((v, i) => {
        if (v.id === tokenizer.eos.id) logits[i] = -Infinity;
      });
    }
    const dist = samplingDistribution(logits, sampling);
    const chosen = sampleIndex(dist.probs, rand());
    const piece = nextToken.vocab[chosen]!;
    const isEos = piece.id === tokenizer.eos.id;
    const sampled: Token = {
      ...piece,
      position: result.contextLength,
      source: 'generated',
      ...(isEos ? { special: true } : {}),
    };
    tokens.push(sampled);

    const generated = tokens.length - promptLength;
    const stopReason = isEos
      ? 'eos'
      : generated >= maxNew
        ? 'maxTokens'
        : tokens.length >= model.maxContext
          ? 'contextFull'
          : undefined;

    steps.push({
      index,
      phase: index === 0 ? 'prefill' : 'decode',
      queryPositions,
      contextLength: result.contextLength,
      kvCacheBefore,
      layers: toLayerTraces(result),
      logits: {
        candidates: topCandidates(nextToken.vocab, logits, dist, CANDIDATES_SHOWN, chosen),
        provenance: 'illustrative',
      },
      sampled,
      ...(stopReason ? { stopReason } : {}),
    });

    if (stopReason) break;
    inputs = [embedToken(sampled.id, model)];
    queryPositions = [sampled.position];
  }

  return {
    version: 1,
    prompt,
    model,
    sampling,
    tokens,
    promptLength,
    embeddings: tokens.map((t) => ({
      position: t.position,
      preview: embedToken(t.id, model).slice(0, EMBED_PREVIEW),
      provenance: 'computed',
    })),
    steps,
    outputText: tokenizer.decode(tokens.slice(promptLength).filter((t) => !t.special)),
    provenance: {
      tokenizer: tokenizer.provenance,
      transformer: 'computed',
      logits: 'illustrative',
      sampling: 'computed',
    },
  };
}

/**
 * Full attention matrix for one layer/head as it exists after `throughStep`:
 * prefill rows plus one row per decode step. Rows are padded to the final context length.
 */
export function attentionMatrix(
  trace: InferenceTrace,
  layer: number,
  head: number,
  throughStep: number,
): number[][] {
  const last = trace.steps[Math.min(throughStep, trace.steps.length - 1)];
  const size = last?.contextLength ?? 0;
  const rows: number[][] = [];
  for (const step of trace.steps.slice(0, throughStep + 1)) {
    const weights = step.layers[layer]?.heads[head]?.weights ?? [];
    for (const row of weights) rows.push([...row, ...new Array<number>(size - row.length).fill(0)]);
  }
  return rows;
}
