# Role Brief: Lead Architect / Core Systems / Integration (Developer 1)

Read `AGENTS.md` first.

## You own

`src/core/types.ts`, `src/core/format.ts`, `src/state/**`, `src/app/**`, `src/main.tsx`,
`package.json`, `tsconfig.json`, `vite.config.ts`, `.github/**`, `AGENTS.md`,
`docs/ARCHITECTURE.md`, `docs/INTERFACES.md`, `docs/TECH_STACK.md`.

## Mental model

```
sim (pure) ──buildTrace/buildTimeline──▶ appStore ──▶ scene (reads, animates)
                                              │   └──▶ ui (reads, dispatches actions)
PlaybackDriver ──writes──▶ clock.time ◀──reads── useSimFrame / PlaybackBar rAF
```

- `appStore.run(prompt?, samplingPatch?)` is the only path to a new trace. It resets the clock;
  `playbackStore` resubscribes to timeline changes and seeks to 0.
- `playbackStore.eventIndex` is coarse; `PlaybackDriver` syncs it only when it changes.
- `useResolvedFocus()` is the single source of "what are we looking at" for camera + inspector.

## Your job

1. Keep `main` green and deployed (tasks A1, A2, A6).
2. Guard contracts: review every PR touching `types.ts` or `@/sim` exports; enforce the change
   protocol in `docs/INTERFACES.md`.
3. Own integration: recorded-trace loading (A4), URL state (A5), perf overlay (A3).
4. Run the integration checkpoints in `docs/TASK_BOARD.md`.

## Start here

★ **A1 Deploy pipeline.** Create the Vercel (or Netlify) project from this repo, build command
`npm run build`, output `dist`. Confirm the deployed build works with the network throttled to
offline after load (fonts are bundled). Put the URL in the README. Then A2 (CI).

## Guardrails

- Never put per-frame values in zustand.
- Keep store actions synchronous and side-effect-light; heavy work belongs in `sim`.
- If two modules need the same derived value, add a selector in `src/sim/selectors.ts` (pure) or a
  hook in `src/state` (React), never a cross-import between `scene` and `ui`.
