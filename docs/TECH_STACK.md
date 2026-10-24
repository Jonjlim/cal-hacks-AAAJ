# Tech Stack

Versions are pinned in `package.json` (resolved October 2026). All runtime dependencies are MIT
or OFL and actively maintained by the pmndrs collective or three.js.

| Concern       | Choice                                                       | Why                                                                                                                                     | Rejected alternatives                                                                |
| ------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Build         | **Vite 8**                                                   | Instant HMR, zero-config TS, static output                                                                                              | Next.js (SSR is irrelevant for a WebGL app), webpack                                 |
| UI framework  | **React 19 + TypeScript 7 (strict)**                         | Team familiarity; R3F requires React                                                                                                    | Svelte/Threlte (smaller ecosystem for this use)                                      |
| 3D            | **three.js 0.186 + @react-three/fiber 9**                    | Declarative scene graph, `useFrame` for imperative per-frame work                                                                       | Babylon (heavier, less React-native), raw three (slower team iteration)              |
| 3D helpers    | **@react-three/drei 10**                                     | `CameraControls` (smooth `setLookAt` transitions), `Text` (SDF text via troika), `Line`, `Billboard`, `Grid`, `Sparkles`, `AdaptiveDpr` | Hand-rolled camera tweening, custom text rendering                                   |
| Post FX       | **@react-three/postprocessing 3 / postprocessing 6**         | Bloom with mipmap blur is the single biggest look upgrade; merges passes efficiently                                                    | three's EffectComposer (more passes, more boilerplate)                               |
| State         | **zustand 5**                                                | ~1 kB, no providers, `getState()` inside `useFrame`, selector-based renders                                                             | Redux (ceremony), Jotai (fine, but less natural for imperative frame reads), Context |
| Animation     | **None added.** `useFrame` + `easeInOut` + `damp`            | All motion is a pure function of sim time; tween libraries fight scrubbing                                                              | GSAP (license nuance, timeline duplicates ours), react-spring                        |
| Styling       | **Plain CSS + CSS variables** generated from `core/theme.ts` | One source of truth for 3D + DOM colors; no build plugin                                                                                | Tailwind (fine, but another dependency and config for ~15 components)                |
| Font          | **@fontsource/jetbrains-mono** (bundled woff)                | Works offline; same font in DOM and troika 3D text                                                                                      | Google Fonts CDN (demo-day network risk)                                             |
| Tests         | **Vitest 5**                                                 | Shares Vite config and aliases; fast                                                                                                    | Jest                                                                                 |
| Formatting    | **Prettier 3**                                               | Removes formatting diffs, a top source of merge conflicts                                                                               | ESLint (left out for now; TS strict catches most issues; add if time allows)         |
| Data viz (2D) | **Hand-rolled CSS bars**                                     | We need ~3 tiny charts                                                                                                                  | d3 / visx (overkill)                                                                 |
| Hosting       | **Static** (Vercel / Netlify / GH Pages)                     | No backend to break                                                                                                                     | Any server                                                                           |

## Dependency notes

- `camera-controls`, `troika-three-text`, `three-stdlib`, and `maath` arrive transitively via drei.
  Don't import them directly; use drei's wrappers (keeps one version).
- Bundle is ~415 kB gzip, mostly three.js. Acceptable for a desktop demo; split later if needed.
- **troika fallback fonts:** troika fetches fallback fonts from a CDN for glyphs missing in the
  supplied font. 3D strings use `showToken3D()` (Latin-1 only) to avoid network fetches.

## Candidate additions (evaluate before adding; get Architect sign-off)

| Package                  | For                        | Notes                                                                                                                        |
| ------------------------ | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `gpt-tokenizer` (MIT)    | Real GPT-2/cl100k BPE (P1) | Pure JS; encodings are ~1–2 MB, so dynamic `import()` only when the user toggles "real tokenizer". Verify license/size first |
| `leva`                   | Dev-only tuning panel      | Dev dependency, tree-shaken from prod                                                                                        |
| `r3f-perf`               | FPS/draw-call overlay      | Dev only                                                                                                                     |
| `@react-three/xr`        | P2 VR mode                 | Only after P1                                                                                                                |
| TransformerLens (Python) | Offline GPT-2 trace export | Not shipped; a script in `tools/` producing JSON                                                                             |

## Things we deliberately avoid

- **Hosted LLM APIs** for visualization data: they don't expose attention or hidden states.
- **In-browser trained models (transformers.js / ONNX)** for P0: tens of MB to download, attention
  outputs not generally exposed in exported graphs, demo-day risk. Recorded traces give real data
  with zero runtime risk.
- **Physics engines, ECS, multiplayer servers**: no P0/P1 need.
