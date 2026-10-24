import type { BlockOp, Provenance, StationId } from '@/core/types';

/**
 * Educational copy. Owner: UX. Every entry separates the beginner summary, the technical
 * detail, and an explicit "what is real here" note. Keep claims defensible; see docs/LLM_PIPELINE.md.
 */
export interface Explainer {
  title: string;
  kicker: string;
  summary: string;
  details: string[];
  math?: string[];
  honesty: string;
  provenance: Provenance;
}

export const STATION_CONTENT: Record<StationId, Explainer> = {
  input: {
    title: 'Input',
    kicker: 'A string of characters',
    summary:
      'Your prompt arrives as plain text. The model cannot read letters directly — it only works with numbers — so the text must be converted first.',
    details: [
      'Chat products wrap your message in a template (system prompt, role markers) before tokenizing. We skip that here.',
      'Everything downstream is deterministic arithmetic until the sampling step.',
    ],
    honesty: 'Real: the prompt you typed.',
    provenance: 'computed',
  },
  tokenizer: {
    title: 'Tokenizer',
    kicker: 'Text → token IDs',
    summary:
      'The text is cut into tokens: whole words, pieces of words, or punctuation. Each token has an ID number from a fixed vocabulary.',
    details: [
      'GPT-style models use byte-pair encoding (BPE): a vocabulary of ~50k–200k pieces learned from data, where frequent strings become single tokens.',
      'Leading spaces are usually part of the token (“ machine” ≠ “machine”).',
      'Tokenization happens once for the prompt. Generated tokens are already IDs, so they skip this step.',
    ],
    honesty:
      'Illustrative: our tokenizer imitates BPE-style splits, but its vocabulary is hand-made and its IDs are hashes, not real GPT-2 IDs.',
    provenance: 'illustrative',
  },
  embedding: {
    title: 'Embedding table',
    kicker: 'IDs → vectors',
    summary:
      'Each token ID selects one row of a big learned table. That row — a list of numbers — becomes the token’s starting representation.',
    details: [
      'Real models use hundreds to thousands of numbers per token (GPT-2 small: 768). We show the first 8 of our toy model’s 16.',
      'Position information depends on the architecture: GPT-2 adds a learned position vector here; models using RoPE (like ours, and LLaMA) instead rotate queries and keys inside attention.',
      'From here on, each token position has its own lane: the residual stream.',
    ],
    math: ['x₀ = E[token_id]        (E: vocab × d_model)'],
    honesty:
      'Computed on toy data: the vectors are pseudo-random rows from a 16-dimensional table, not learned embeddings.',
    provenance: 'computed',
  },
  transformer: {
    title: 'Transformer blocks',
    kicker: 'The same block, repeated',
    summary:
      'The vectors pass through a stack of identical-looking layers. Each layer lets tokens exchange information (attention), then refines each token on its own (MLP).',
    details: [
      'Each block reads from and adds back into the residual stream; it never replaces it. That is why the lanes run straight through.',
      'Our toy model has 4 layers; GPT-2 small has 12, large modern models have 32–120+.',
      'This prototype uses the common pre-norm ordering: x + Attn(Norm(x)), then x + MLP(Norm(x)). The original 2017 Transformer and BERT normalize after the add instead.',
    ],
    honesty:
      'Computed: every number is real arithmetic of a 4-layer toy Transformer — but its weights are random, so its activations carry no meaning.',
    provenance: 'computed',
  },
  lmHead: {
    title: 'LM head',
    kicker: 'Vector → a score for every token',
    summary:
      'The final vector of the last position is compared with every entry in the vocabulary, producing one score (a logit) per possible next token.',
    details: [
      'Only the last position’s logits are needed to choose the next token, so only it is projected during generation.',
      'Logits are unnormalized: they can be any real number. They describe the next token only — not the whole answer.',
      'Many models reuse (tie) the embedding table as this projection.',
    ],
    math: ['logits = Norm(h_last) · Wᵤ      (d_model × vocab)'],
    honesty:
      'Illustrative: a real LM head would turn the Transformer’s state into logits. Because our toy weights are untrained, scores here come from a tiny n-gram model over a built-in corpus so the output is readable.',
    provenance: 'illustrative',
  },
  sampler: {
    title: 'Sampler',
    kicker: 'Scores → one chosen token',
    summary:
      'Scores become probabilities, and one token is picked. Settings like temperature control how adventurous that choice is.',
    details: [
      'Temperature divides logits before softmax: < 1 sharpens the distribution, > 1 flattens it, 0 means always pick the top token (greedy).',
      'Top-k keeps only the k highest-scoring tokens; top-p (nucleus) keeps the smallest set whose probability adds up to p.',
      'Wireframe ghosts show plain softmax probabilities; solid pillars show the distribution actually sampled from.',
    ],
    math: ['p_i = exp(z_i / T) / Σ_j exp(z_j / T)'],
    honesty:
      'Computed: temperature, top-k, top-p and the seeded random draw are applied exactly, to the illustrative scores from the LM head.',
    provenance: 'computed',
  },
  output: {
    title: 'Output',
    kicker: 'IDs → text, one token at a time',
    summary:
      'Each chosen token is turned back into text and appended. The new token is then fed back in, and the whole process repeats until a stop condition.',
    details: [
      'Stop conditions: an end-of-text token, a max-token budget, a stop string, or a full context window.',
      'Prefill processes the whole prompt in parallel once. Each decode step after that processes only the one new token, reusing cached keys and values for everything before it.',
    ],
    honesty: 'Real decoding loop, applied to illustrative next-token scores.',
    provenance: 'computed',
  },
};

export const BLOCK_OP_CONTENT: Record<BlockOp, Explainer> = {
  norm1: {
    title: 'RMSNorm (before attention)',
    kicker: 'Keep the numbers well-scaled',
    summary: 'Each vector is rescaled to a standard size so the next operation sees stable inputs.',
    details: [
      'RMSNorm divides by the root-mean-square of the vector (then multiplies by a learned gain). LayerNorm also subtracts the mean.',
      'It acts on each position separately — no information moves between tokens.',
    ],
    math: ['RMSNorm(x) = x / √(mean(x²) + ε) ⊙ g'],
    honesty: 'Computed (the learned gain is fixed to 1 in the toy model).',
    provenance: 'computed',
  },
  attention: {
    title: 'Causal multi-head self-attention',
    kicker: 'The only place tokens talk to each other',
    summary:
      'Each token asks a question (query), every earlier token offers a label (key), and the best matches decide whose information (values) gets mixed in.',
    details: [
      'Q, K, V are linear projections of the normalized vectors, split into heads. Each head can learn a different kind of relationship.',
      'Scores are dot products q·k scaled by 1/√d_head. The causal mask sets scores for future positions to −∞, so after softmax they are exactly 0.',
      'The attention weights (the matrix) only say how much to mix; the output is the weighted sum of value vectors, projected back into the residual stream.',
      'With RoPE, queries and keys are rotated by an angle that depends on position, so q·k depends on relative distance.',
      'K and V for every processed position are stored in the KV cache; a decode step computes one new row of the matrix.',
    ],
    math: [
      'Q = xW_Q,  K = xW_K,  V = xW_V',
      'A = softmax( QKᵀ/√d_head + M )    M_ij = −∞ if j > i',
      'out = concat_h(A_h V_h) · W_O',
    ],
    honesty:
      'Computed: these are the real attention weights of the toy model, including RoPE and the KV cache. With random weights the patterns show the mechanics, not linguistic meaning.',
    provenance: 'computed',
  },
  residual1: {
    title: 'Residual add (attention)',
    kicker: 'Add, don’t replace',
    summary:
      'The attention output is added to the token’s existing vector, so earlier information is preserved.',
    details: [
      'Residual connections make deep stacks trainable and let each layer make small edits to a shared “stream”.',
    ],
    math: ['x ← x + Attention(RMSNorm(x))'],
    honesty: 'Computed.',
    provenance: 'computed',
  },
  norm2: {
    title: 'RMSNorm (before MLP)',
    kicker: 'Rescale again',
    summary: 'The updated vector is normalized again before the MLP.',
    details: ['Same operation as before attention, with its own learned gain.'],
    math: ['RMSNorm(x) = x / √(mean(x²) + ε) ⊙ g'],
    honesty: 'Computed.',
    provenance: 'computed',
  },
  mlp: {
    title: 'Feed-forward network (MLP)',
    kicker: 'Per-token processing',
    summary:
      'Each token’s vector is expanded, passed through a nonlinearity, and compressed back — independently for every position.',
    details: [
      'Typically 4× wider than the residual stream (toy: 16 → 64 → 16). Most of a model’s parameters live in these layers.',
      'GPT-2 uses GELU; many recent models use gated variants such as SwiGLU.',
      'No information moves between positions here — the towers stand on separate lanes.',
    ],
    math: ['MLP(x) = GELU(x W₁) W₂'],
    honesty: 'Computed with random weights; tower height shows the size of each update.',
    provenance: 'computed',
  },
  residual2: {
    title: 'Residual add (MLP)',
    kicker: 'Write back to the stream',
    summary: 'The MLP output is added to the residual stream, completing the layer.',
    details: [
      'The result flows into the next layer, which repeats the same pattern with different weights.',
    ],
    math: ['x ← x + MLP(RMSNorm(x))'],
    honesty: 'Computed.',
    provenance: 'computed',
  },
};

export const PROVENANCE_LABEL: Record<Provenance, { label: string; description: string }> = {
  computed: {
    label: 'Computed',
    description: 'Real arithmetic performed in your browser (on a toy model where noted).',
  },
  illustrative: {
    label: 'Illustrative',
    description: 'A simplified stand-in chosen to explain the concept; not from a real LLM.',
  },
  recorded: {
    label: 'Recorded',
    description: 'Captured from a real model run.',
  },
};
