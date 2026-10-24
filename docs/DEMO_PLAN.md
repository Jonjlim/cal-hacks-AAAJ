# Demo Plan

Owner: UX. Target: **3 minutes** live, with a 30-second fallback version.

## Setup checklist

- [ ] Production build open from the deployed URL **and** `npm run preview` on the laptop (offline backup)
- [ ] Browser full screen, 1440×900 or larger, zoom 100%, hardware acceleration on
- [ ] Prompt preset: _"The robot opened its eyes and"_; sampling defaults (T 0.7, top-k 8, top-p 0.95, seed 13)
- [ ] Laptop on power; notifications off
- [ ] Fallback screen recording of the full journey on the desktop
- [ ] Measured FPS noted here: high FX ___ / low FX ___

## Script (≈ 3:00)

| Time | Say                                                                                                                                                                                          | Do                                                             | Judges see                                                         |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------ |
| 0:00 | "Everyone uses LLMs. Almost no one has seen what happens inside one. So we built a way to walk in."                                                                                          | Intro card visible → **Enter the machine**                     | Camera flies into a neon computational city                        |
| 0:15 | "Your prompt is cut into tokens, not words. Each gets an ID."                                                                                                                                | (guided)                                                       | Tokenizer ring spins, text shatters into packets with IDs          |
| 0:30 | "Each ID pulls a row of numbers from a table. That vector is the token now."                                                                                                                 | (guided)                                                       | Embedding table lookup, bar-chart vectors                          |
| 0:40 | "Every lane is one token. This is a Transformer layer. Arches are attention, the _only_ place tokens share information. Notice the light only goes backwards: a token can't see the future." | Pause in layer-1 attention (`Space`)                           | Arcs between lanes, causal matrix with dark triangle               |
| 1:05 | "These are the exact weights this toy model computes. Each head mixes information differently, and every row adds up to 100%."                                                               | Click through heads in the inspector; pick a query token       | Matrix recolors; weights list                                      |
| 1:20 | "Then each token goes through its own MLP tower, and the result is added back into its lane."                                                                                                | `Space` to resume                                              | Towers pulse, residual nodes flash                                 |
| 1:35 | "At the end, only the last position predicts the next token, as a score for every token in the vocabulary."                                                                                  | (guided)                                                       | LM-head fan, sampler pillars rise, one turns pink                  |
| 1:50 | "Temperature changes how adventurous it is."                                                                                                                                                 | Click **Sampler** in nav; drag temperature to 1.6 then 0       | Pillars flatten / collapse to one, live                            |
| 2:10 | "Then the new token loops back in. And here's the trick that makes chat fast: only the _new_ token runs through the layers; everything earlier is cached."                                   | **Re-run** at 2×; point at KV tiles + caption `KV cache 6 → 7` | Pink loop; one packet traveling; cache tiles growing one per layer |
| 2:35 | "Everything is labeled: computed versus illustrative. We show the real mechanics, not fake 'AI thoughts'."                                                                                   | Point at badges                                                | Provenance badges                                                  |
| 2:45 | "Next: real GPT-2 recordings so every number is from a production-style model."                                                                                                              | Overview (`O`)                                                 | Whole machine, response on output screen                           |

## 30-second version

Enter → let guided run at 2× → pause on layer-1 attention for one sentence → resume → point at
the pink loop + KV cache → done.

## Likely judge questions

- _Is this a real model?_ The attention/KV-cache mechanics are real computations of a tiny
  Transformer in your browser; it's untrained, so next-token scores come from a labeled n-gram
  stand-in. The architecture accepts recorded traces from real models (P1).
- _Why not call an API?_ APIs don't expose attention weights or hidden states.
- _What's the hardest part?_ Keeping the 3D a pure function of simulation time so you can pause,
  scrub, and step anywhere, and keeping every visual claim technically defensible.

## Fallback behavior

| Failure                   | Response                                                        |
| ------------------------- | --------------------------------------------------------------- |
| Low FPS                   | FX toggle (top right) or reload with `?low`                     |
| WebGL crash               | App shows a fallback message; switch to the backup laptop/video |
| Custom prompt reads oddly | Use a preset; explain the n-gram stand-in honestly              |
| Camera lost               | `O` for overview, `G` to resume guided                          |
| No network                | Use `npm run preview` locally; nothing needs the internet       |
