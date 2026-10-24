import { GRAPH } from './graphData';
import { hashString } from './noise';

/**
 * Prompt -> SignalTrace.
 *
 * IMPORTANT: everything produced here is an ARTISTIC SIMULATION. Tokens are
 * split with a simple regex, routes and attention weights are deterministic
 * hashes. No language model runs in this prototype. The SignalTrace shape is
 * the contract a real backend (Python / PyTorch / TransformerLens over a
 * WebSocket) will fill in later — see docs/ARCHITECTURE.md.
 */

export type StageId = 'input' | 'tokenization' | 'embedding' | 'attention' | 'transformer' | 'output';

export const STAGES: { id: StageId; label: string; caption: string }[] = [
  { id: 'input', label: 'Input', caption: 'Your prompt enters the network as one bright stream.' },
  { id: 'tokenization', label: 'Tokenization', caption: 'The stream splits into token fragments.' },
  { id: 'embedding', label: 'Embedding', caption: 'Each token becomes a geometric vector.' },
  { id: 'attention', label: 'Attention', caption: 'Tokens exchange information — links pulse between them.' },
  { id: 'transformer', label: 'Transformer', caption: 'Repeated blocks refine every token representation.' },
  { id: 'output', label: 'Output', caption: 'Fragments converge into one output stream.' },
];

export interface TraceToken {
  text: string;
  /** Simulated vocabulary id (hash). */
  tokenId: number;
}

export interface SignalTrace {
  source: 'simulated' | 'model';
  prompt: string;
  tokens: TraceToken[];
  /** routes[token][layer] = node id visited by that token at each layer. */
  routes: string[][];
  /** attention[i][j] = weight token i gives token j (rows sum to 1, causal). */
  attention: number[][];
  output: { text: string; note: string };
}

/** Anything that can turn a prompt into a trace. A model backend implements this later. */
export interface TraceSource {
  readonly kind: 'simulated' | 'model';
  createTrace(prompt: string): Promise<SignalTrace>;
}

export const MAX_TOKENS = 16;

/** Toy tokenizer: words + punctuation, long words split into 4-char subwords. */
export function simulateTokenize(prompt: string): string[] {
  const raw = prompt.match(/[A-Za-z0-9']+|[^\sA-Za-z0-9]/g) ?? [];
  const out: string[] = [];
  for (const w of raw) {
    if (w.length > 7) {
      for (let i = 0; i < w.length; i += 4) out.push(i === 0 ? w.slice(0, 4) : `##${w.slice(i, i + 4)}`);
    } else out.push(w);
  }
  return out.slice(0, MAX_TOKENS);
}

export function simulateTrace(prompt: string): SignalTrace {
  const words = simulateTokenize(prompt.trim() || 'Hello machine.');
  const tokens = words.map((text) => ({ text, tokenId: hashString(text.toLowerCase()) % 50257 }));

  const routes = tokens.map((t, k) =>
    GRAPH.layers.map((ids, l) => {
      if (ids.length === 1) return ids[0];
      // Bias the first token through the walkable path so the player sees it.
      if (k === 0) return ids[Math.floor(ids.length / 2)];
      return ids[hashString(`${t.text}:${k}:${l}`) % ids.length];
    }),
  );

  const n = tokens.length;
  const attention = tokens.map((_, i) => {
    const row = tokens.map((__, j) => {
      if (j > i) return 0;
      const h = (hashString(`${i}-${j}-${prompt}`) % 1000) / 1000;
      return Math.exp(-(i - j) * 0.55 + h * 1.4);
    });
    const sum = row.reduce((a, b) => a + b, 0) || 1;
    return row.map((v) => v / sum);
  });

  return {
    source: 'simulated',
    prompt,
    tokens,
    routes,
    attention,
    output: {
      text: words.join(' '),
      note: `Simulated: ${n} token fragment${n === 1 ? '' : 's'} reassembled. No model is connected, so no prediction is shown.`,
    },
  };
}

export const simulatedSource: TraceSource = {
  kind: 'simulated',
  createTrace: async (prompt) => simulateTrace(prompt),
};
