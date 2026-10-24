/** Minimal dense linear algebra on plain arrays. Sizes are tiny; clarity beats speed. */

export type Vec = number[];
/** Row-major matrix: m[row][col]. */
export type Mat = number[][];

export function zeros(n: number): Vec {
  return new Array<number>(n).fill(0);
}

export function dot(a: Vec, b: Vec): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}

export function add(a: Vec, b: Vec): Vec {
  return a.map((x, i) => x + b[i]!);
}

export function norm(a: Vec): number {
  return Math.sqrt(dot(a, a));
}

/** x (length n) times W (n × m) => length m. */
export function vecMat(x: Vec, w: Mat): Vec {
  const m = w[0]?.length ?? 0;
  const out = zeros(m);
  for (let i = 0; i < x.length; i++) {
    const xi = x[i]!;
    const row = w[i]!;
    for (let j = 0; j < m; j++) out[j]! += xi * row[j]!;
  }
  return out;
}

/** Numerically stable softmax. Entries equal to -Infinity get probability exactly 0. */
export function softmax(logits: Vec): Vec {
  let max = -Infinity;
  for (const l of logits) if (l > max) max = l;
  if (max === -Infinity) return logits.map(() => 0);
  const exps = logits.map((l) => (l === -Infinity ? 0 : Math.exp(l - max)));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

export function rmsNorm(x: Vec, eps = 1e-6): Vec {
  const ms = dot(x, x) / x.length;
  const inv = 1 / Math.sqrt(ms + eps);
  return x.map((v) => v * inv);
}

/** tanh approximation of GELU (as used by GPT-2). */
export function gelu(x: number): number {
  return 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x ** 3)));
}

/**
 * Rotary position embedding applied to one head vector (even length).
 * Rotates each pair (x[2i], x[2i+1]) by angle position * base^(-2i/d).
 */
export function applyRope(x: Vec, position: number, base = 10000): Vec {
  const d = x.length;
  const out = x.slice();
  for (let i = 0; i < d / 2; i++) {
    const theta = position * Math.pow(base, (-2 * i) / d);
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const a = x[2 * i]!;
    const b = x[2 * i + 1]!;
    out[2 * i] = a * c - b * s;
    out[2 * i + 1] = a * s + b * c;
  }
  return out;
}
