# Design System

Tokens live in `src/core/theme.ts` (owner: Graphics) and are exported to CSS as `--c-*`
variables at startup. Never hard-code a hex value in a component.

## Semantic color

Color answers "what kind of computation is this?". Keep it consistent in 3D and DOM.

| Token         | Hex       | Meaning                                    | Used by                                          |
| ------------- | --------- | ------------------------------------------ | ------------------------------------------------ |
| `void`        | `#02040a` | background                                 | canvas clear, fog                                |
| `panel`       | `#060c16` | HUD panels, screens                        | DOM panels, terminal backs                       |
| `grid`        | `#0b3a46` | floor, unlit lanes                         | Grid, future lanes                               |
| `token`       | `#00ffa3` | token data, residual stream, prompt tokens | lanes, packets, tokenizer, embedding +           |
| `attention`   | `#22d3ff` | cross-position mixing, KV cache            | arches, arcs, cache tiles, matrix                |
| `mlp`         | `#3b82ff` | per-position computation                   | MLP towers, embedding −                          |
| `norm`        | `#7dd3fc` | normalization                              | norm gates                                       |
| `probability` | `#f5d90a` | logits, probabilities, sampling            | LM head rays, sampler pillars, lab sliders       |
| `generated`   | `#ff4fd8` | generated tokens, autoregressive loop      | loop arc, chosen pillar, generated chips, output |
| `masked`      | `#1a2230` | causally masked entries                    | matrix upper triangle                            |
| `danger`      | `#ff5370` | errors                                     | prompt errors, fallbacks                         |

Per-head tints (`HEAD_COLORS`): cyan, green, violet, pink, cycled.

## Light and effects

- Emissive look via `meshBasicMaterial` / `lineBasicMaterial` with `toneMapped={false}` and colors
  pushed above 1.0 using `glow(color, intensity)`. Bloom threshold is 0.18, so intensity ≈ 1 is a
  soft glow and ≥ 2 is a hot highlight. Reserve ≥ 2 for "this is happening now".
- Additive blending only for light-like things (arcs). Depth write off for them.
- No PBR lighting needed; the world is self-illuminated.
- Fog 45→140 units fades distant structures for depth.

## 3D visual grammar

| Concept                  | Form                                               | Rule                                                                                                        |
| ------------------------ | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Flow direction           | +x                                                 | every station sits on the x axis in pipeline order                                                          |
| Token position           | a lane along x, spaced in z (`LANE_SPACING = 0.6`) | a token never changes lane                                                                                  |
| Token representation     | small spinning cube ("packet") on its lane         | only the positions computed _now_ are drawn                                                                 |
| Mixing across positions  | arcs between lanes under per-head arches           | only attention may draw anything connecting two lanes                                                       |
| Per-position computation | one object per lane (towers, nodes)                | never span lanes                                                                                            |
| Memory                   | flat tiles on the floor beside arches              | appear once, persist, dim after creation                                                                    |
| Probability              | vertical height                                    | solid = final distribution, wireframe ghost = raw softmax                                                   |
| Generation               | pink                                               | anything pink is output of the model                                                                        |
| Station identity         | each station has one silhouette                    | ring (tokenizer), table (embedding), arches+towers (block), fan (LM head), pillars (sampler), screens (I/O) |
| Activity                 | brightness pulse with `sin(π·progress)`            | stations dim back when idle                                                                                 |

## Camera

- `CameraControls`, `smoothTime 0.8`, polar angle capped above the floor, distance 2.5–120.
- Close-ups use a **three-quarter view from upstream (−x, +z, above)**, so lanes spread
  across the screen and attention arcs (in the y–z plane) read face-on.
- Guided mode changes target at most once per "chapter" (station, layer-1 op, stack, overview) to
  avoid whiplash. Fast decode steps use the overview.
- Any user drag switches to Explore without moving the camera.
- Keep the subject left of center when the inspector is open (right column).

## Typography

- JetBrains Mono everywhere (bundled). 3D labels: bold, letter-spaced, `textDim` unless hovered.
- 3D strings must be Latin-1 (`showToken3D`: `·` for spaces, `<end>` for EOS). DOM strings may use
  `␣` (`showToken`).
- Sizes (world units): station labels 0.42, layer labels 0.36, token labels 0.24, numbers 0.15.

## UI conventions

- Layout: top bar (brand, prompt, FX), left nav, right inspector, bottom stack (caption → tokens →
  transport). Panels are glassy (`panel` at 82% + blur) with a faint cyan border.
- Panels capture pointer events; empty HUD space passes clicks to the canvas.
- Inspector structure: eyebrow → title → kicker → beginner summary → interactive widget →
  collapsible "Technical detail" (bullets + formula block) → provenance badge + honesty line.
- Badges: **Computed** (green), **Illustrative** (yellow), **Recorded** (cyan).
- Keyboard: Space, ←/→, Home, G, O/Esc. Inputs swallow shortcuts.
- Motion in DOM is minimal (150 ms transitions); the 3D world carries the motion.
- Accessibility: buttons have titles/labels, the caption is `aria-live="polite"`, contrast ≥ 4.5:1
  for body text on panels.
