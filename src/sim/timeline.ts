import { showToken } from '@/core/format';
import type {
  BlockOp,
  GenerationStep,
  InferenceTrace,
  SimEvent,
  SimEventKind,
  StationId,
  Timeline,
} from '@/core/types';

/** Seconds per beat at 1× speed, before pacing. Tuned for a ~60 s guided run. */
const BEAT = {
  prompt: 1.6,
  tokenize: 2.6,
  embed: 2.0,
  norm: 0.6,
  attention: 2.6,
  residual: 0.6,
  mlp: 1.4,
  lmHead: 1.6,
  sample: 2.4,
  emit: 1.0,
  stop: 2.0,
};

/** First pass is shown slowly; later decode steps speed up so the demo keeps momentum. */
function stepPace(step: number): number {
  return step === 0 ? 1 : step === 1 ? 0.5 : 0.13;
}

function layerPace(layer: number): number {
  return layer === 0 ? 1 : 0.45;
}

const STOP_LABEL: Record<NonNullable<GenerationStep['stopReason']>, string> = {
  eos: 'Stopped: the model chose the end-of-text token',
  maxTokens: 'Stopped: reached the max-new-tokens budget',
  contextFull: 'Stopped: the context window is full',
};

/** Flattens a trace into sequential, non-overlapping events. Pure and deterministic. */
export function buildTimeline(trace: InferenceTrace): Timeline {
  const events: SimEvent[] = [];
  let t = 0;

  const push = (
    id: string,
    kind: SimEventKind,
    station: StationId,
    step: number,
    positions: number[],
    duration: number,
    label: string,
    extra: { layer?: number; op?: BlockOp } = {},
  ) => {
    events.push({ id, kind, station, step, positions, start: t, duration, label, ...extra });
    t += duration;
  };

  const promptPositions = trace.tokens.slice(0, trace.promptLength).map((tk) => tk.position);
  const { model, sampling } = trace;

  for (const step of trace.steps) {
    const s = step.index;
    const pace = stepPace(s);
    const q = step.queryPositions;
    const last = q[q.length - 1]!;

    if (s === 0) {
      push(
        's0.prompt',
        'prompt.received',
        'input',
        0,
        [],
        BEAT.prompt,
        `Prompt received: “${trace.prompt}”`,
      );
      push(
        's0.tokenize',
        'tokenize',
        'tokenizer',
        0,
        promptPositions,
        BEAT.tokenize,
        `Tokenizer splits the text into ${trace.promptLength} tokens`,
      );
      push(
        's0.embed',
        'embed',
        'embedding',
        0,
        q,
        BEAT.embed,
        `Each token ID looks up a ${model.dModel}-number embedding vector`,
      );
    } else {
      const tk = trace.tokens[last]!;
      push(
        `s${s}.embed`,
        'embed',
        'embedding',
        s,
        q,
        BEAT.embed * pace,
        `“${showToken(tk.text)}” loops back as the next input — already an ID, no re-tokenizing`,
      );
    }

    for (let l = 0; l < model.nLayers; l++) {
      const lp = pace * layerPace(l);
      const L = `Layer ${l + 1}`;
      const at = (op: BlockOp) => ({ layer: l, op });
      push(
        `s${s}.l${l}.norm1`,
        'block.norm',
        'transformer',
        s,
        q,
        BEAT.norm * lp,
        `${L} · RMSNorm rescales each vector`,
        at('norm1'),
      );
      push(
        `s${s}.l${l}.attention`,
        'block.attention',
        'transformer',
        s,
        q,
        BEAT.attention * lp,
        step.phase === 'prefill'
          ? `${L} · attention: ${q.length} queries × ${step.contextLength} keys, causally masked`
          : `${L} · attention: 1 new query reads ${step.kvCacheBefore} cached keys + its own`,
        at('attention'),
      );
      push(
        `s${s}.l${l}.residual1`,
        'block.residual',
        'transformer',
        s,
        q,
        BEAT.residual * lp,
        `${L} · attention output is added to the residual stream`,
        at('residual1'),
      );
      push(
        `s${s}.l${l}.norm2`,
        'block.norm',
        'transformer',
        s,
        q,
        BEAT.norm * lp,
        `${L} · RMSNorm before the MLP`,
        at('norm2'),
      );
      push(
        `s${s}.l${l}.mlp`,
        'block.mlp',
        'transformer',
        s,
        q,
        BEAT.mlp * lp,
        `${L} · MLP transforms each position independently`,
        at('mlp'),
      );
      push(
        `s${s}.l${l}.residual2`,
        'block.residual',
        'transformer',
        s,
        q,
        BEAT.residual * lp,
        `${L} · MLP output is added to the residual stream`,
        at('residual2'),
      );
    }

    push(
      `s${s}.lmHead`,
      'lmHead.project',
      'lmHead',
      s,
      [last],
      BEAT.lmHead * pace,
      `Only the last position is projected to ${model.vocabSize.toLocaleString('en-US')} vocabulary logits`,
    );
    const tempLabel = sampling.temperature <= 0 ? 'greedy' : `T=${sampling.temperature}`;
    push(
      `s${s}.sample`,
      'sample.select',
      'sampler',
      s,
      [last],
      BEAT.sample * pace,
      `Sampling (${tempLabel}, top-k ${sampling.topK || 'off'}, top-p ${sampling.topP}) picks “${showToken(step.sampled.text)}”`,
    );
    push(
      `s${s}.emit`,
      'detokenize.emit',
      'output',
      s,
      [step.sampled.position],
      BEAT.emit * pace,
      step.sampled.special
        ? 'End-of-text token — nothing is printed'
        : `“${showToken(step.sampled.text)}” is decoded to text and appended`,
    );

    if (step.stopReason) {
      push(
        `s${s}.stop`,
        'generation.stop',
        'output',
        s,
        [],
        BEAT.stop,
        STOP_LABEL[step.stopReason],
      );
    }
  }

  return { events, duration: t };
}
