# Task Board

IDs: `A` Architect · `G` Graphics · `S` LLM Simulation · `U` UX. Priority P0/P1/P2.
Status: ⬜ todo · 🟨 in progress · ✅ done. Update this file in the same PR as the work.
**First task for each person is marked ★.**

## Ownership map (primary owner per path)

| Path                                                               | Owner                                         |
| ------------------------------------------------------------------ | --------------------------------------------- |
| `src/core/types.ts`, `src/core/format.ts`                          | Architect                                     |
| `src/core/theme.ts`                                                | Graphics                                      |
| `src/core/config.ts`                                               | Sim                                           |
| `src/state/**`, `src/app/**`, `src/main.tsx`                       | Architect                                     |
| `src/sim/**`, `tools/**` (new), `public/traces/**` (new)           | Sim                                           |
| `src/scene/**`                                                     | Graphics                                      |
| `src/ui/**`, `src/content/**`                                      | UX                                            |
| `package.json`, configs, `.github/**`, `AGENTS.md`                 | Architect                                     |
| `docs/ARCHITECTURE.md`, `docs/INTERFACES.md`, `docs/TECH_STACK.md` | Architect                                     |
| `docs/LLM_PIPELINE.md`                                             | Sim                                           |
| `docs/DESIGN_SYSTEM.md`                                            | Graphics                                      |
| `docs/DEMO_PLAN.md`, `docs/PROJECT_VISION.md`                      | UX                                            |
| `docs/TASK_BOARD.md`, `docs/IMPLEMENTATION_PLAN.md`                | everyone (append-only edits to your own rows) |

## Done in M0 (foundation)

| ID  | Task                                                                                                       | Owner | Status |
| --- | ---------------------------------------------------------------------------------------------------------- | ----- | ------ |
| A0  | Vite + React + TS strict + R3F scaffold, scripts, prettier, vitest                                         | A     | ✅     |
| A0b | Shared contracts (`types.ts`), stores, clock, focus policy                                                 | A     | ✅     |
| S0  | Tokenizer, toy Transformer w/ KV cache, n-gram, sampling, trace, timeline, selectors, 22 tests             | S     | ✅     |
| G0  | World layout, 7 stations, layer blocks, packets, lanes, arcs, KV tiles, matrix, loop, bloom, camera rig    | G     | ✅     |
| U0  | HUD, prompt bar, transport, caption, token strip, nav, inspector, attention inspector, sampling lab, intro | U     | ✅     |

## Architect (Developer 1)

| ID  | Task                                                                    | P   | Depends | Output                                                                            | Definition of done                                                           |
| --- | ----------------------------------------------------------------------- | --- | ------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| ★A1 | Deploy pipeline                                                         | P0  | —       | Vercel/Netlify project; preview deploys per PR; URL in README                     | `main` auto-deploys; production build loads offline-cached fonts; URL shared |
| A2  | CI (workflow written ✅; enable branch protection once a remote exists) | P0  | —       | `.github/workflows/ci.yml` runs `npm ci && npm run check && npm run build`        | Red CI blocks merge                                                          |
| A3  | Dev perf overlay                                                        | P0  | —       | `r3f-perf` behind `?perf` (dev dep)                                               | FPS + draw calls visible; numbers recorded in DEMO_PLAN for 2 laptops        |
| A4  | Recorded-trace loader plumbing                                          | P1  | S3      | `appStore.loadTrace(trace)` + preset picker that maps presets → JSON              | Switching presets swaps trace with zero scene changes                        |
| A5  | URL state (`?prompt=&t=&focus=`)                                        | P1  | —       | Shareable deep links, used for demo bookmarks                                     | Reload restores prompt, time, focus                                          |
| A6  | Integration checkpoints & release tags                                  | P0  | —       | Tag `m1`, `m2`, `m3`; changelog in PR descriptions                                | Each tag has a deployed URL                                                  |
| A7  | ESLint with import-boundary rules                                       | P1  | —       | `eslint-plugin-boundaries` or `no-restricted-imports` matching ARCHITECTURE rules | `scene` importing `ui` fails lint                                            |

## Graphics (Developer 2)

| ID  | Task                                         | P   | Depends | Output                                                                                              | Definition of done                                                      |
| --- | -------------------------------------------- | --- | ------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| ★G1 | Station silhouette pass                      | P0  | —       | Distinct, polished forms for tokenizer, embedding, LM head, sampler, I/O screens                    | Each station recognizable in overview screenshot without labels         |
| G2  | Packet trails                                | P0  | —       | Instanced/line trails behind moving packets (fade over ~0.4 s of sim time)                          | Trails correct when scrubbing backwards (derive from time, not history) |
| G3  | Readability tuning                           | P0  | U4      | Adjust camera poses, label sizes, bloom so each chapter frame reads at 1440×900 with inspector open | Fresh-eyes test passes                                                  |
| G4  | Perf budget                                  | P0  | A3      | ≥ 50 FPS on weakest laptop at high FX; ≥ 60 at low                                                  | Numbers logged                                                          |
| G5  | Q/K/V micro-visualization                    | P1  | S4      | In attention close-up: token packet splits into Q/K/V, Q·K beams, softmax resize                    | Uses trace data only; badge shown                                       |
| G6  | Lane pulse shader                            | P1  | —       | Residual lanes brighten with `residualNorms` as packets pass                                        | No per-frame allocations                                                |
| G7  | Layout for recorded traces (`displayLayers`) | P1  | S5      | Map 12 real layers → N drawn layers with ellipsis segment                                           | GPT-2 trace renders without overlap                                     |
| G8  | Hologram/scanline shader for screens         | P1  | —       | Shader material for input/output screens                                                            | Bloom-friendly, ≤ 1 ms GPU                                              |

## LLM Simulation (Developer 3)

| ID  | Task                                | P   | Depends | Output                                                                                             | Definition of done                                                       |
| --- | ----------------------------------- | --- | ------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| ★S1 | Accuracy review of all copy         | P0  | —       | Comments/PR on `src/content/*` and timeline labels vs LLM_PIPELINE.md                              | Zero known inaccuracies; UX merges fixes                                 |
| S2  | Better off-corpus behavior          | P0  | —       | Corpus expansion + smarter backoff so arbitrary prompts produce plausible text                     | 10 random judge-style prompts produce non-degenerate output; tests added |
| S3  | GPT-2 trace exporter                | P1  | —       | `tools/export_trace.py` (TransformerLens or HF) → `public/traces/*.json` matching `InferenceTrace` | One preset exported and loaded in a vitest fixture by hour 10            |
| S4  | Expose Q/K/V previews in trace      | P1  | —       | Optional `LayerTrace.qkvPreview` (first 4 dims per head per query)                                 | Additive contract change; tests                                          |
| S5  | `displayLayers` contract            | P1  | S3      | Optional `InferenceTrace.displayLayers: number[]` + timeline support                               | Agreed with Graphics; docs updated                                       |
| S6  | Real BPE tokenizer option           | P1  | —       | `gpt-tokenizer` lazy-loaded `Tokenizer` impl                                                       | Round-trip tests; bundle impact measured                                 |
| S7  | KV-cache-off counterfactual numbers | P1  | —       | Selector: positions recomputed per step with/without cache                                         | Unit tested; consumed by U/G                                             |

## UX (Developer 4)

| ID  | Task                                | P   | Depends | Output                                                                                            | Definition of done                              |
| --- | ----------------------------------- | --- | ------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| ★U1 | Copy pass: beginner clarity         | P0  | S1      | Tighten every `summary` to ≤ 2 sentences a 14-year-old understands                                | Read aloud test; Sim approves accuracy          |
| U2  | Chapters (guided auto-pause)        | P1  | —       | 5 chapter beats (tokenize, embed, attention L1, sample, first loop) with narrator card + Continue | Works with scrubbing; can be disabled           |
| U3  | Onboarding polish                   | P0  | —       | Intro → first 10 s hints ("this is a token"), legend of color grammar                             | First-time user knows what to click within 15 s |
| U4  | Demo script + bookmarks             | P0  | A5      | `docs/DEMO_PLAN.md` timings validated on deployed build                                           | 3 rehearsals ≤ 3:00                             |
| U5  | Inspector for MLP / norm / residual | P1  | —       | Small interactive widget per op (e.g. RMSNorm before/after bars from trace)                       | Uses real trace numbers                         |
| U6  | Head comparison small multiples     | P1  | —       | 2×2 mini matrices in attention inspector                                                          | Click selects head                              |
| U7  | Responsive / small-laptop layout    | P1  | —       | Inspector collapses to drawer < 1200 px                                                           | Usable at 1280×720                              |
| U8  | Accessibility pass                  | P1  | —       | Focus order, labels, reduced-motion (slower camera, no sparkles)                                  | Keyboard-only run-through works                 |

## Integration checkpoints

| When    | What                                                                                  |
| ------- | ------------------------------------------------------------------------------------- |
| Hour 6  | Everyone merges first PR; deployed build reviewed together on the big screen (15 min) |
| Hour 12 | **M1 gate**: fresh-eyes test + perf numbers; decide which P1s to commit to            |
| Hour 18 | Recorded trace integration check (S3 → A4 → G7)                                       |
| Hour 24 | **M2 gate**, feature freeze for new systems                                           |
| Hour 30 | **M3 gate**: three rehearsals, fallback video, final deploy                           |
