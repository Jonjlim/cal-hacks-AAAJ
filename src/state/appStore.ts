import { create } from 'zustand';
import { DEFAULT_SAMPLING, PRESET_PROMPTS } from '@/core/config';
import type { AppMode, FocusTarget, InferenceTrace, SamplingConfig, Timeline } from '@/core/types';
import { buildTimeline, buildTrace, TraceError } from '@/sim';
import { clock } from './clock';

export type SamplingDraft = Pick<SamplingConfig, 'temperature' | 'topK' | 'topP'>;

interface AppState {
  mode: AppMode;
  focus: FocusTarget;
  introOpen: boolean;
  prompt: string;
  sampling: SamplingConfig;
  trace: InferenceTrace;
  timeline: Timeline;
  error: string | null;
  /** Attention head shown in attention visuals and inspector. */
  attentionHead: number;
  /** 'low' disables post-processing and lowers pixel ratio for weak GPUs. */
  quality: 'high' | 'low';
  /**
   * Unapplied sampling settings from the Sampling Lab. The 3D sampler previews them on the
   * current step's candidates; `run()` applies them for real.
   */
  samplingDraft: SamplingDraft | null;

  setMode(mode: AppMode): void;
  setSamplingDraft(draft: SamplingDraft | null): void;
  setQuality(quality: 'high' | 'low'): void;
  /** Explicit navigation; switches to explore mode so guided camera stops overriding it. */
  focusOn(target: FocusTarget): void;
  closeIntro(): void;
  setAttentionHead(head: number): void;
  /** Rebuilds trace + timeline. Returns false (and sets `error`) on invalid input. */
  run(prompt?: string, sampling?: Partial<SamplingConfig>): boolean;
}

function compute(prompt: string, sampling: SamplingConfig) {
  const trace = buildTrace({ prompt, sampling });
  return { trace, timeline: buildTimeline(trace) };
}

const initialPrompt = PRESET_PROMPTS[0]!;
const initial = compute(initialPrompt, DEFAULT_SAMPLING);

export const useAppStore = create<AppState>()((set, get) => ({
  mode: 'guided',
  focus: { kind: 'overview' },
  introOpen: true,
  prompt: initialPrompt,
  sampling: DEFAULT_SAMPLING,
  trace: initial.trace,
  timeline: initial.timeline,
  error: null,
  attentionHead: 0,
  quality: new URLSearchParams(globalThis.location?.search ?? '').has('low') ? 'low' : 'high',

  samplingDraft: null,

  setMode: (mode) => set({ mode }),
  setSamplingDraft: (samplingDraft) => set({ samplingDraft }),
  setQuality: (quality) => set({ quality }),
  focusOn: (focus) => set({ focus, mode: 'explore' }),
  closeIntro: () => set({ introOpen: false }),
  setAttentionHead: (attentionHead) => set({ attentionHead }),

  run(prompt, samplingPatch) {
    const nextPrompt = prompt ?? get().prompt;
    const sampling = { ...get().sampling, ...samplingPatch };
    try {
      const result = compute(nextPrompt, sampling);
      clock.time = 0;
      set({ ...result, prompt: nextPrompt, sampling, error: null, samplingDraft: null });
      return true;
    } catch (err) {
      set({
        error: err instanceof TraceError ? err.message : 'Simulation failed. Try another prompt.',
      });
      if (!(err instanceof TraceError)) console.error(err);
      return false;
    }
  },
}));
