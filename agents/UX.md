# Role Brief: Interaction / Educational UX Engineer (Developer 4)

Read `AGENTS.md`, `docs/DESIGN_SYSTEM.md` (UI conventions), and `docs/DEMO_PLAN.md` first.

## You own

`src/ui/**`, `src/content/**`, `docs/DEMO_PLAN.md`, `docs/PROJECT_VISION.md`.

## What exists

| Component                | Role                                                                       |
| ------------------------ | -------------------------------------------------------------------------- |
| `Hud.tsx`                | Grid layout; only panels take pointer events                               |
| `PromptBar.tsx`          | Prompt + presets (datalist) + Run; shows `TraceError`s                     |
| `PlaybackBar.tsx`        | Transport; scrubber/time updated by rAF from `clock`, not React state      |
| `Caption.tsx`            | Phase line (PREFILL / DECODE n · KV cache a→b) + current event label       |
| `TokenStrip.tsx`         | Token chips, prompt vs generated, active positions glow                    |
| `StationNav.tsx`         | Follow-prompt toggle, overview, stations, per-layer attention shortcuts    |
| `Inspector.tsx`          | Explainer for the resolved focus + embedded widgets                        |
| `AttentionInspector.tsx` | Head + query selection, exact weights, masked entries                      |
| `SamplingLab.tsx`        | Sliders write `samplingDraft` (3D pillars preview live); Re-run / New seed |
| `IntroOverlay.tsx`       | First-run card                                                             |
| `useKeyboard.ts`         | Space, ←/→, Home, G, O/Esc                                                 |
| `content/stations.ts`    | `STATION_CONTENT`, `BLOCK_OP_CONTENT`, `PROVENANCE_LABEL`                  |

## Your job

Make a first-time visitor understand the journey in one guided run, and make the demo flawless.

## Start here

★ **U1 Copy pass**: rewrite each `summary` in `content/stations.ts` for a curious 14-year-old (≤ 2
sentences), keep `details` technical, never weaken `honesty`. Get Sim's approval on accuracy. Then
**U3 onboarding** and **U4 demo script** validation on the deployed build.

## Interaction rules

- Store actions only (`run`, `focusOn`, `seek`, `setSamplingDraft`, ...). Never import from `scene/`.
- Anything updating at frame rate uses a rAF loop + refs (see `PlaybackBar`), not state.
- Every new panel shows a `ProvenanceBadge` if it shows numbers.
- Shortcuts must not fire while typing (`useKeyboard` already ignores form fields).
- Interactions must demonstrate what they claim: e.g. the Sampling Lab preview is over the top-32
  candidates, and the UI says so.
