import type { Provenance } from '@/core/types';
import { hashString } from './random';

export interface TokenPiece {
  id: number;
  text: string;
}

/**
 * Anything that turns text into token pieces. A real BPE tokenizer (e.g. the
 * `gpt-tokenizer` package) can implement this interface without touching the scene.
 */
export interface Tokenizer {
  name: string;
  provenance: Provenance;
  eos: TokenPiece;
  encode(text: string): TokenPiece[];
  decode(pieces: readonly { text: string }[]): string;
}

/** GPT-2 style pre-tokenization: contractions, words with a leading space, numbers, punctuation. */
const PRETOKENIZE = /'(?:s|t|re|ve|m|ll|d)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu;

/** Common suffixes split off long words, imitating how BPE reuses frequent subwords. */
const SUFFIXES = [
  'ization',
  'ation',
  'ing',
  'tion',
  'ness',
  'ment',
  'able',
  'ally',
  'ers',
  'ed',
  'er',
  'ly',
];

const MAX_WHOLE_WORD = 7;
const CHUNK = 4;

export const EOS_PIECE: TokenPiece = { id: 50256, text: '<|endoftext|>' };

function idFor(text: string): number {
  // Stable pseudo-ID in GPT-2's vocabulary range, avoiding the EOS id.
  return 256 + (hashString(text) % 49900);
}

function splitWord(word: string): string[] {
  const lead = word.startsWith(' ') ? ' ' : '';
  const core = lead ? word.slice(1) : word;
  if (core.length <= MAX_WHOLE_WORD || !/^\p{L}+$/u.test(core)) return [word];

  const pieces: string[] = [];
  let stem = core;
  const suffix = SUFFIXES.find(
    (s) => stem.length - s.length >= 3 && stem.toLowerCase().endsWith(s),
  );
  if (suffix) stem = stem.slice(0, stem.length - suffix.length);

  // Leading space stays attached to the first piece, as in GPT-2's vocabulary.
  let first = true;
  while (stem.length > 0) {
    const take = stem.length <= MAX_WHOLE_WORD - 1 ? stem.length : CHUNK + (first ? 1 : 0);
    pieces.push((first ? lead : '') + stem.slice(0, take));
    stem = stem.slice(take);
    first = false;
  }
  if (suffix) pieces.push(core.slice(core.length - suffix.length));
  return pieces;
}

/**
 * Illustrative tokenizer. Its splits resemble real BPE (leading-space words, subword
 * pieces, separate punctuation) but its vocabulary is not learned from data and its IDs
 * are hashes, not GPT-2 IDs. Concatenating piece texts always reproduces the input exactly.
 */
export const toyTokenizer: Tokenizer = {
  name: 'toy-bpe-like',
  provenance: 'illustrative',
  eos: EOS_PIECE,
  encode(text: string): TokenPiece[] {
    const words = text.match(PRETOKENIZE) ?? [];
    return words.flatMap(splitWord).map((t) => ({ id: idFor(t), text: t }));
  },
  decode(pieces) {
    return pieces.map((p) => p.text).join('');
  },
};
