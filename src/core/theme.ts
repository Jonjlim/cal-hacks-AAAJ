/**
 * Design tokens shared by the 3D scene and the DOM UI (exported to CSS variables at startup).
 * See docs/DESIGN_SYSTEM.md for meaning. Semantic colors encode *what kind of computation*.
 */
export const COLORS = {
  void: '#02040a',
  panel: '#060c16',
  grid: '#0b3a46',
  text: '#d8fff4',
  textDim: '#6f9aa0',
  /** Token / residual-stream data. */
  token: '#00ffa3',
  /** Attention (cross-position communication). */
  attention: '#22d3ff',
  /** MLP (per-position computation). */
  mlp: '#3b82ff',
  /** Normalization gates. */
  norm: '#7dd3fc',
  /** Logits, probabilities, sampling. */
  probability: '#f5d90a',
  /** Generated output, the autoregressive loop. */
  generated: '#ff4fd8',
  masked: '#1a2230',
  danger: '#ff5370',
} as const;

/** Per-head tints for multi-head attention. */
export const HEAD_COLORS = ['#22d3ff', '#00ffa3', '#a78bfa', '#f472b6'] as const;

export const FONT_STACK = `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace`;

export function applyCssVariables(root: HTMLElement = document.documentElement): void {
  for (const [key, value] of Object.entries(COLORS)) {
    root.style.setProperty(`--c-${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`, value);
  }
  root.style.setProperty('--font', FONT_STACK);
}
