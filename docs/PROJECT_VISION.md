# Project Vision

## Pitch

_Shrink yourself down and step inside the brain of an AI._ **Inside the Machine** turns the
inference pass of a language model into a place you can stand in: a dark, glowing computational
city where your prompt is cut into tokens, carried along luminous lanes, debated by arches of
attention, refined in towers, scored, chosen, and looped back in, one token at a time.

It should look like a sci-fi exploration game, behave like a real simulation, and teach like a
science museum.

## Audience

| Visitor                                 | What they should leave with                                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Curious non-technical (judges, friends) | "It reads in pieces, every piece becomes numbers, the pieces look at each other, and it writes one piece at a time, feeding itself." |
| CS students who've heard "Transformer"  | Tokens ≠ words; attention vs MLP; residual stream; causal mask; logits vs probabilities; temperature                                 |
| ML-literate (mentors, ML judges)        | Accurate details: pre-norm ordering, RoPE vs learned positions, KV cache, prefill vs decode, top-k/top-p order, clear provenance     |

## Experience pillars

1. **The world is the diagram.** Spatial grammar carries meaning: lanes = positions, cross-lane
   light = attention, per-lane towers = MLP, tiles = cache, loop = autoregression. Panels add
   depth; they're never the main explanation.
2. **Watch, then poke.** Guided playback first, then the visitor takes control: scrub, step,
   inspect a head, change temperature, change the prompt.
3. **Two zoom levels.** Macro: the whole factory. Micro: inside the attention of one layer, with
   exact numbers.
4. **Honest by construction.** Computed vs illustrative is labeled everywhere. No "the AI is
   thinking about robots" theater.

## Core journey (≈ 60 s at 1×)

1. Prompt glows on the input terminal.
2. Tokenizer ring spins; text shatters into token packets that spread onto lanes with IDs.
3. Embedding table lights rows; each token becomes a bar-chart vector.
4. Layer 1 in close-up: norm gate flash, arches light up, arcs of attention leap backward across
   lanes (never forward), cache tiles appear, attention matrix board shows the numbers, residual
   nodes flash, MLP towers pulse per lane.
5. Layers 2–4 sweep by.
6. Packets converge; the LM head fans out into the vocabulary; sampler pillars rise; one turns
   pink and is chosen.
7. The new token rides the pink loop back to the start. Only it travels the layers this time,
   reading the cached tiles. Repeat, faster.
8. The response assembles on the output screen; the end-of-text token stops the machine.

## Visual identity

Tron / Matrix-grade digital architecture: near-black void, neon wireframes, emissive geometry
with bloom, an infinite grid floor, distant towers for scale, drifting particles. Color carries
meaning (see [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)): green = tokens/data, cyan = attention,
blue = MLP, yellow = probabilities, pink = generation.

Concept art provided by the team is a mood reference only; it is not a technically accurate
diagram, and the world's layout is driven by the pipeline above.

## Intended impact

A visitor who knew nothing about Transformers can explain tokenization, attention, layers, and
autoregressive generation in their own words after three minutes, and a technical visitor finds
nothing to correct.

## Non-goals (for the hackathon)

Training visualization, claims about model "understanding", a full GPT-2 in the browser,
multiplayer, mobile, VR.
