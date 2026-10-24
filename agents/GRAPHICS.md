# Role Brief: 3D World / Graphics Engineer (Developer 2)

Read `AGENTS.md` and `docs/DESIGN_SYSTEM.md` first.

## You own

`src/scene/**`, `src/core/theme.ts`, `docs/DESIGN_SYSTEM.md`.

## How the scene works

- `Experience.tsx`: Canvas, fog, quality switch, `PlaybackDriver`, `CameraRig`, `World`, `Effects`.
- `layout.ts`: **all** spatial constants and camera poses. Stations on +x, token lanes on z.
  `eventAnchorX(event)` gives where packets sit during an event; `loopPoint(u)` is the
  autoregressive arc.
- `hooks.ts → useSimFrame(cb)`: per-frame `{ event, progress, trace, timeline, delta, elapsed }`.
  Animate by mutating refs here. Rebuild geometry only when `event`/`trace` changes (`useMemo`
  keyed on them), never per frame.
- `StationShell`: click-to-focus, hover, active glow, billboard label. Wrap every station in it.
- Folders: `stations/` (macro facilities), `transformer/` (`LayerBlock`), `flow/` (things that
  move or connect: packets, lanes, arcs, KV tiles, matrix, loop).

## Visual grammar you must preserve

Only attention connects lanes. Per-token things are per lane. Pink = generated. Yellow =
probability. Cyan = attention/cache. Green = token data. Blue = MLP. Brightness ≥ 2× = "happening now".

## Performance rules

- Per-token objects use `instancedMesh` with `count` set to what's live (see `LayerBlock`,
  `KVCacheTiles`, `TokenPackets`).
- Reuse `GEOMETRY` from `materials.ts`; reuse `THREE.Color`/`Object3D` temporaries at module scope.
- `troika` Text is costly; avoid hundreds of labels. 3D strings via `showToken3D` only.
- Check the low-FX path (`?low`) still looks intentional.

## Start here

★ **G1 Station silhouette pass.** Today's stations are first-draft geometry. Give each a distinct,
iconic silhouette that still reads at overview distance: tokenizer (cutter ring, done-ish), embedding
(tall table, add a glowing row index), LM head (fan, make it feel like a projection _onto_ a
vocabulary wall), sampler (pillars, add a base dial), I/O screens. Then G2 packet trails.

To screenshot specific moments: in the dev console,
`__itm.app.getState().closeIntro(); __itm.playback.getState().seek(8)`.

## Guardrails

- Never read `ui/` or put DOM in the canvas (no drei `Html` for core visuals; it costs perf and
  layering).
- Visuals must be correct after scrubbing backward: derive from `(event, progress)`, no
  accumulated state except damped cosmetics (glow levels).
- Don't encode new data in visuals without a matching trace field; ask Sim to add it.
