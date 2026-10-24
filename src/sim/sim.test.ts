import { describe, expect, it } from 'vitest';
import { DEFAULT_SAMPLING, PRESET_PROMPTS, TOY_MODEL } from '@/core/config';
import { applyRope, softmax } from './math';
import { eventIndexAt, eventProgress, nextBoundary, prevBoundary } from './playback';
import { sampleIndex, samplingDistribution } from './sampling';
import { emittedTokens, kvCacheLength } from './selectors';
import { buildTimeline } from './timeline';
import { attentionMatrix, buildTrace, TraceError } from './trace';
import { toyTokenizer } from './tokenizer';
import { createKVCache, createToyWeights, embedToken, forward } from './toyTransformer';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('math', () => {
  it('softmax sums to 1 and zeroes -Infinity', () => {
    const p = softmax([1, 2, -Infinity, 3]);
    expect(sum(p)).toBeCloseTo(1, 10);
    expect(p[2]).toBe(0);
  });

  it('RoPE preserves vector length', () => {
    const v = [0.3, -1.2, 2, 0.5];
    const r = applyRope(v, 7);
    expect(Math.hypot(...r)).toBeCloseTo(Math.hypot(...v), 10);
  });
});

describe('tokenizer', () => {
  it('round-trips text exactly', () => {
    for (const text of [...PRESET_PROMPTS, 'Tokenization, attention & generation!']) {
      expect(toyTokenizer.decode(toyTokenizer.encode(text))).toBe(text);
    }
  });

  it('keeps leading spaces and splits long words into subwords', () => {
    const pieces = toyTokenizer.encode('The tokenization').map((p) => p.text);
    expect(pieces[0]).toBe('The');
    expect(pieces[1]!.startsWith(' ')).toBe(true);
    expect(pieces.length).toBeGreaterThan(2);
  });

  it('is deterministic', () => {
    expect(toyTokenizer.encode('hello world')).toEqual(toyTokenizer.encode('hello world'));
  });
});

describe('sampling', () => {
  const logits = [3, 2, 1, 0, -1];

  it('greedy picks the argmax with probability 1', () => {
    const d = samplingDistribution(logits, { temperature: 0, topK: 0, topP: 1 });
    expect(d.probs).toEqual([1, 0, 0, 0, 0]);
  });

  it('top-k keeps exactly k tokens', () => {
    const d = samplingDistribution(logits, { temperature: 1, topK: 2, topP: 1 });
    expect(d.kept.filter(Boolean)).toHaveLength(2);
    expect(sum(d.probs)).toBeCloseTo(1, 10);
  });

  it('top-p keeps the smallest prefix reaching p', () => {
    const d = samplingDistribution(logits, { temperature: 1, topK: 0, topP: 0.5 });
    expect(d.kept).toEqual([true, false, false, false, false]);
  });

  it('higher temperature flattens the distribution', () => {
    const cold = samplingDistribution(logits, { temperature: 0.5, topK: 0, topP: 1 });
    const hot = samplingDistribution(logits, { temperature: 2, topK: 0, topP: 1 });
    expect(hot.probs[0]!).toBeLessThan(cold.probs[0]!);
  });

  it('inverse-CDF sampling never selects zero-probability tokens', () => {
    const probs = [0, 0.5, 0, 0.5];
    for (const u of [0, 0.25, 0.49, 0.5, 0.99, 0.999999]) {
      expect([1, 3]).toContain(sampleIndex(probs, u));
    }
  });
});

describe('toy transformer', () => {
  const weights = createToyWeights(TOY_MODEL);
  const ids = toyTokenizer.encode('The robot opened its eyes').map((p) => p.id);
  const embeds = ids.map((id) => embedToken(id, TOY_MODEL));

  it('attention rows are causal and sum to 1', () => {
    const r = forward(weights, TOY_MODEL, embeds, createKVCache(TOY_MODEL));
    for (const layer of r.layers) {
      for (const head of layer.heads) {
        head.forEach((row, i) => {
          expect(sum(row)).toBeCloseTo(1, 10);
          row.forEach((w, j) => {
            if (j > i) expect(w).toBe(0);
          });
        });
      }
    }
  });

  it('KV-cached decode matches full recomputation', () => {
    const full = forward(weights, TOY_MODEL, embeds, createKVCache(TOY_MODEL));
    const cache = createKVCache(TOY_MODEL);
    forward(weights, TOY_MODEL, embeds.slice(0, -1), cache);
    const step = forward(weights, TOY_MODEL, embeds.slice(-1), cache);
    const lastRow = (r: typeof full, l: number, h: number) => r.layers[l]!.heads[h]!.at(-1)!;
    for (let l = 0; l < TOY_MODEL.nLayers; l++) {
      for (let h = 0; h < TOY_MODEL.nHeads; h++) {
        lastRow(step, l, h).forEach((w, j) => expect(w).toBeCloseTo(lastRow(full, l, h)[j]!, 10));
      }
    }
    step.hidden[0]!.forEach((x, i) => expect(x).toBeCloseTo(full.hidden.at(-1)![i]!, 10));
  });
});

describe('trace', () => {
  const trace = buildTrace({ prompt: PRESET_PROMPTS[0]!, sampling: DEFAULT_SAMPLING });

  it('is deterministic for the same inputs', () => {
    expect(buildTrace({ prompt: PRESET_PROMPTS[0]!, sampling: DEFAULT_SAMPLING })).toEqual(trace);
  });

  it('has one prefill followed by single-token decode steps', () => {
    expect(trace.steps[0]!.phase).toBe('prefill');
    expect(trace.steps[0]!.queryPositions).toHaveLength(trace.promptLength);
    for (const s of trace.steps.slice(1)) {
      expect(s.phase).toBe('decode');
      expect(s.queryPositions).toHaveLength(1);
      expect(s.kvCacheBefore).toBe(s.contextLength - 1);
    }
    expect(trace.steps.at(-1)!.stopReason).toBeDefined();
  });

  it('greedy decoding continues the corpus sentence', () => {
    const greedy = buildTrace({
      prompt: PRESET_PROMPTS[0]!,
      sampling: { ...DEFAULT_SAMPLING, temperature: 0 },
    });
    expect(greedy.outputText.trim().length).toBeGreaterThan(0);
    expect(greedy.steps.at(-1)!.stopReason).toMatch(/eos|maxTokens/);
  });

  it('assembles a lower-triangular attention matrix across steps', () => {
    const m = attentionMatrix(trace, 0, 0, trace.steps.length - 1);
    expect(m).toHaveLength(trace.steps.at(-1)!.contextLength);
    m.forEach((row, i) => row.forEach((w, j) => j > i && expect(w).toBe(0)));
  });

  it('rejects empty prompts', () => {
    expect(() => buildTrace({ prompt: '   ', sampling: DEFAULT_SAMPLING })).toThrow(TraceError);
  });
});

describe('selectors', () => {
  const trace = buildTrace({ prompt: PRESET_PROMPTS[1]!, sampling: DEFAULT_SAMPLING });
  const tl = buildTimeline(trace);
  const find = (id: string) => tl.events.find((e) => e.id === id)!;

  it('fills each layer cache when that layer attends', () => {
    const P = trace.promptLength;
    expect(kvCacheLength(trace, find('s0.l1.norm1'), 1)).toBe(0);
    expect(kvCacheLength(trace, find('s0.l1.attention'), 1)).toBe(P);
    expect(kvCacheLength(trace, find('s0.l1.attention'), 2)).toBe(0);
    expect(kvCacheLength(trace, find('s1.embed'), 0)).toBe(P);
    expect(kvCacheLength(trace, find('s1.l0.attention'), 0)).toBe(P + 1);
  });

  it('emits generated tokens only after their detokenize event', () => {
    expect(emittedTokens(trace, find('s0.sample'))).toHaveLength(0);
    expect(emittedTokens(trace, find('s0.emit'))).toHaveLength(1);
    expect(emittedTokens(trace, tl.events.at(-1)!)).toHaveLength(trace.steps.length);
  });
});

describe('timeline & playback', () => {
  const trace = buildTrace({ prompt: PRESET_PROMPTS[2]!, sampling: DEFAULT_SAMPLING });
  const tl = buildTimeline(trace);

  it('events are contiguous and unique', () => {
    const ids = new Set(tl.events.map((e) => e.id));
    expect(ids.size).toBe(tl.events.length);
    tl.events.forEach((e, i) => {
      if (i > 0) {
        const prev = tl.events[i - 1]!;
        expect(e.start).toBeCloseTo(prev.start + prev.duration, 10);
      }
    });
    expect(tl.events.at(-1)!.kind).toBe('generation.stop');
  });

  it('has an attention event for every layer of every step', () => {
    const n = tl.events.filter((e) => e.kind === 'block.attention').length;
    expect(n).toBe(trace.steps.length * trace.model.nLayers);
  });

  it('locates events and boundaries', () => {
    const e = tl.events[5]!;
    const mid = e.start + e.duration / 2;
    expect(eventIndexAt(tl, mid)).toBe(5);
    expect(eventProgress(e, mid)).toBeCloseTo(0.5, 10);
    expect(nextBoundary(tl, mid)).toBeCloseTo(tl.events[6]!.start, 10);
    expect(prevBoundary(tl, mid)).toBeCloseTo(e.start, 10);
    expect(prevBoundary(tl, e.start)).toBeCloseTo(tl.events[4]!.start, 10);
    expect(eventIndexAt(tl, -5)).toBe(0);
    expect(eventIndexAt(tl, tl.duration + 5)).toBe(tl.events.length - 1);
  });
});
