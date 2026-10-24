import { CORPUS } from './corpus';
import { toyTokenizer, type TokenPiece, type Tokenizer } from './tokenizer';

/**
 * Interpolated trigram model over the toy corpus. This is NOT a Transformer: it is a
 * transparent stand-in that produces readable next-token scores, because the toy
 * Transformer's random weights would produce gibberish. Scores are log-probabilities,
 * which play the role of logits.
 */
export interface NextTokenModel {
  vocab: readonly TokenPiece[];
  /** Logits aligned with `vocab`. */
  logits(context: readonly string[]): number[];
}

const LAMBDA = { tri: 0.7, bi: 0.25, uni: 0.05 };

export function buildNgramModel(
  corpus: readonly string[] = CORPUS,
  tokenizer: Tokenizer = toyTokenizer,
): NextTokenModel {
  const vocabMap = new Map<string, TokenPiece>();
  const uni = new Map<string, number>();
  const bi = new Map<string, Map<string, number>>();
  const tri = new Map<string, Map<string, number>>();
  let total = 0;

  const bump = (table: Map<string, Map<string, number>>, key: string, next: string) => {
    let row = table.get(key);
    if (!row) table.set(key, (row = new Map()));
    row.set(next, (row.get(next) ?? 0) + 1);
  };

  for (const sentence of corpus) {
    const pieces = [...tokenizer.encode(sentence), tokenizer.eos];
    const texts = pieces.map((p) => p.text);
    for (const p of pieces) vocabMap.set(p.text, p);
    for (let i = 0; i < texts.length; i++) {
      const t = texts[i]!;
      uni.set(t, (uni.get(t) ?? 0) + 1);
      total++;
      if (i >= 1) bump(bi, texts[i - 1]!, t);
      if (i >= 2) bump(tri, `${texts[i - 2]!}\u0000${texts[i - 1]!}`, t);
    }
  }

  const vocab = [...vocabMap.values()];

  const prob = (row: Map<string, number> | undefined, t: string) => {
    if (!row) return 0;
    let sum = 0;
    for (const c of row.values()) sum += c;
    return (row.get(t) ?? 0) / sum;
  };

  return {
    vocab,
    logits(context) {
      const a = context[context.length - 2];
      const b = context[context.length - 1];
      const triRow = a !== undefined && b !== undefined ? tri.get(`${a}\u0000${b}`) : undefined;
      const biRow = b !== undefined ? bi.get(b) : undefined;
      // Redistribute weight when a context was never seen (simple backoff).
      const wTri = triRow ? LAMBDA.tri : 0;
      const wBi = biRow ? LAMBDA.bi + (triRow ? 0 : LAMBDA.tri * 0.8) : 0;
      const wUni = 1 - wTri - wBi;
      return vocab.map((v) => {
        const p =
          wTri * prob(triRow, v.text) +
          wBi * prob(biRow, v.text) +
          wUni * ((uni.get(v.text) ?? 0) / total);
        return Math.log(p + 1e-9);
      });
    },
  };
}
