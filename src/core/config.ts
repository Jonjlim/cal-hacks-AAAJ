import type { ModelConfig, SamplingConfig } from './types';

/**
 * The toy model whose attention we actually compute in the browser.
 * Shapes are tiny so every number can be shown; the architecture matches a
 * modern pre-norm decoder (RMSNorm, RoPE, causal multi-head attention, GELU MLP).
 */
export const TOY_MODEL: ModelConfig = {
  name: 'toy-decoder-4L',
  nLayers: 4,
  nHeads: 4,
  dModel: 16,
  dHead: 4,
  dMlp: 64,
  vocabSize: 50257,
  maxContext: 32,
  positionEncoding: 'rope',
  normPlacement: 'pre',
  normType: 'rmsnorm',
  mlpActivation: 'gelu',
};

export const DEFAULT_SAMPLING: SamplingConfig = {
  temperature: 0.7,
  topK: 8,
  topP: 0.95,
  maxNewTokens: 10,
  minNewTokens: 3,
  seed: 13,
};

export const MAX_PROMPT_TOKENS = 14;

export const PRESET_PROMPTS: readonly string[] = [
  'The robot opened its eyes and',
  'Inside the machine, every word',
  'Attention lets each token',
  'The network learned to',
];
