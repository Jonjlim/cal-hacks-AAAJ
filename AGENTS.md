# AGENTS.md: Rules for Coding Agents (and Humans)

## Project context

**Inside the Machine** is a browser-based 3D educational experience showing LLM inference inside
a decoder-only Transformer (Cal Hacks 13.0). Stack: Vite, React 19, TypeScript (strict), three.js,
React Three Fiber, drei, postprocessing, zustand, Vitest. No backend.

Read first: `README.md` → `docs/ARCHITECTURE.md` → `docs/INTERFACES.md` → your role brief in
`agents/` → `docs/TASK_BOARD.md`.

## Non-negotiables

1. **Accuracy and honesty.** Never present illustrative data as real. Every user-visible number
   or claim maps to a `Provenance`. Check claims against `docs/LLM_PIPELINE.md`. Never describe
   the model as thinking, understanding, or intending.
2. **`main` stays demo-able.** `npm run check` and `npm run build` must pass before you finish.
3. **Respect module boundaries.**
   - `src/sim` → only `src/core`. No React/Three imports.
   - `src/scene` → `core`, `state`, `@/sim` (public index only). Never `ui`.
   - `src/ui` → `core`, `state`, `content`, `@/sim`. Never `scene`.
   - Nothing imports from `src/app` except `main.tsx`.
4. **No per-frame React state.** Animate via `useSimFrame`/`useFrame` + refs. Never `setState` in a
   frame loop. The playback `clock` is written only by `PlaybackDriver` and `seek()`.
5. **Rendering is a function of simulation time.** Visuals must be correct after scrubbing
   backward or stepping, so derive state from `(event, progress)`, not accumulated history.
6. **No new runtime dependency** without Architect approval and an entry in `docs/TECH_STACK.md`.

## Directory responsibilities

| Path          | Purpose                                     | Owner                                    |
| ------------- | ------------------------------------------- | ---------------------------------------- |
| `src/core`    | Types, config, theme tokens, formatters     | Architect (theme: Graphics; config: Sim) |
| `src/state`   | Stores, clock, focus policy                 | Architect                                |
| `src/app`     | Shell, error boundaries                     | Architect                                |
| `src/sim`     | Pure simulation + tests                     | Sim                                      |
| `src/scene`   | Everything inside `<Canvas>`                | Graphics                                 |
| `src/ui`      | DOM HUD                                     | UX                                       |
| `src/content` | Educational copy                            | UX                                       |
| `docs/`       | See ownership table in `docs/TASK_BOARD.md` | mixed                                    |

## Coding conventions

- TypeScript strict with `noUncheckedIndexedAccess`; prefer `!` only where an index is provably in
  range; prefer narrow union types over strings.
- Named exports; one component per file; files ≤ ~200 lines (split before growing past).
- Components: `PascalCase.tsx`; hooks `useX.ts`; pure modules `camelCase.ts`.
- Imports via `@/` alias across modules; relative within a module.
- Colors only from `COLORS` / CSS `var(--c-*)`. Layout numbers only from `scene/layout.ts`.
- 3D text strings must go through `showToken3D` (Latin-1 only; avoids troika CDN fallback fetches).
- Reuse `GEOMETRY` from `scene/materials.ts`; use `instancedMesh` for anything per token.
- Comments explain constraints and intent, not what the next line does.
- Prettier formats everything (`npm run format`).

## Testing and validation

- Sim logic → unit tests in `src/sim/*.test.ts` (Vitest, node env). Any new selector or trace
  field needs a test. Keep the invariants listed in `docs/INTERFACES.md` green.
- Scene/UI → manual check: fresh reload; guided run start to finish; scrub backward; step
  with ←/→; explore mode click on each station; low-FX mode; no console errors.
- Debug in the dev console: `__itm.app.getState()`, `__itm.playback.getState().seek(12)`.

## Documentation update rules

- Changed a contract (`types.ts`, `@/sim` exports, store shape)? Update `docs/INTERFACES.md` in
  the same change.
- Changed what's computed vs illustrative? Update `docs/LLM_PIPELINE.md` and the content
  `honesty` strings.
- Finished or started a task? Update its row in `docs/TASK_BOARD.md`.
- New dependency? `docs/TECH_STACK.md`.

## Parallel development and avoiding conflicting edits

- Work only in paths you own. Need a change elsewhere? Make the **smallest additive** change and
  flag the owner in the PR, or ask them.
- Shared hot files (`types.ts`, `appStore.ts`, `layout.ts`, `World.tsx`, `Hud.tsx`): keep edits
  to a few lines, append rather than reorder, never reformat unrelated code.
- Adding a station or panel = new file + one line in `World.tsx` / `Hud.tsx`.
- Branches: `<role>/<task-id>-<slug>` (e.g. `graphics/G2-packet-trails`). Small PRs (< 400 lines),
  squash-merge, rebase on `main` before merging.
- Commit messages: imperative, prefixed with area: `scene: add packet trails`.
- Stubbing: unfinished features ship behind a presence check or a URL flag (`?flag=name`), never
  half-visible in the default experience.
- Agents: do not run destructive git commands, do not rewrite others' files wholesale, and do not
  commit generated `dist/`.
