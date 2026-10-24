# Inside the Machine

*Enter the network. Follow the signal. Discover how AI works.*

A story-driven sci-fi exploration game for Cal Hacks 13.0. It turns a neural-network diagram into a 3D world you can walk through. You play **Echo**, a small digital explorer. You walk the glowing highways between computational hubs, pull the camera back to see the whole network, and send a prompt through it as a luminous signal.

> **Honesty note:** prompt processing in this build is an **artistic simulation**. Tokens, routes and attention weights come from a deterministic toy pipeline, and no language model runs. The data contract is ready for real measurements later (see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#simulation-vs-real-measurements)).

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with hot reload |
| `npm run typecheck` | TypeScript, no emit |
| `npm run build` | Typecheck + production bundle in `dist/` |
| `npm run preview` | Serve the production bundle |

## Controls

| Input | Action |
|---|---|
| WASD / arrows | Move |
| Mouse | Rotate camera (click the game to capture the pointer) |
| Space | Jump |
| Shift | Sprint / boost |
| F | Energy pulse (physics impulse on nearby props) |
| E | Interact with a hub console |
| P | Open the prompt console |
| Tab | Network overview ↔ back to Echo |
| R | Respawn at the last hub |
| Esc | Pause / release pointer / close panels |
| Overview: drag · wheel · click | Orbit · zoom · select node |

## What's implemented

- **Layered network world:** 28 nodes across 8 layers and 5 regions (Input & Tokenization → Embedding → Attention → Transformer → Output), fully connected between adjacent layers (111 edges). The layout is fixed, not force-directed.
- **Walkable main path:** 8 hub decks joined by 7 highways, with segmented glowing barriers and static Rapier colliders.
- **Procedural node structures:** a portal-tunnel gate plus tokenizer, embedding-lattice, attention-gyroscope, transformer-stack and output-funnel variants. All share instanced glass cores with sprocket halos and light beams.
- **Third-person explorer:** Rapier kinematic character controller with acceleration, sprint, jump (with coyote time), gravity, slopes and steps, a fall safety net, respawn, and a procedural walk cycle with thruster flames.
- **Camera manager:** one owner for the camera across EXPLORATION, NETWORK_OVERVIEW, NODE_FOCUS and TRANSITION. Transitions interpolate distance logarithmically with a FOV "warp" kick.
- **Network overview:** the same scene seen from orbit, with labels, a "you are here" beacon, hover and click selection, focus, and *Travel here*.
- **Signal flow:** ambient particles ride edges from input to output and energise nodes as they arrive.
- **Prompt simulation:** the sky stream enters the Input Gate, splits into token fragments, morphs into geometric embeddings, pulses attention links, passes through two transformer layers, then converges into an output beam. A stage tracker in the HUD follows along.
- **Physics gameplay:** pushable convex-hull data fragments, a scatterable cache stack, bouncing energy orbs with configurable restitution, an energy pulse (impulse + cooldown), and collision-driven sparks and shock rings.
- **Environment:** an animated wireframe terrain adapted from WebGL Shader Lab, a hazy "cloud city" of towers, a ground route to a horizon beacon, banded planets, a nebula sky, stars, asteroids and drifting dust.
- **Graphics presets:** Low, Medium and High, which change pixel ratio, bloom, MSAA, shadows, particle counts, terrain density and detail distance.

## Tech stack

React 19 · TypeScript · Vite 7 · three 0.186 · @react-three/fiber 9 · @react-three/drei 10 · @react-three/rapier 2 (Rapier 0.19) · @react-three/postprocessing 3 · zustand 5

## Architecture (short)

```
src/
  app/         App shell, scene composition, input bridge
  camera/      CameraManager (sole camera owner), pose interpolation
  world/       graph-driven world: nodes, connections, decks/bridges, terrain, sky, scenery
  player/      kinematic character controller + procedural explorer
  physics/     PhysicsWorld, InteractiveFragment, EnergyOrb, EnergyPulse, CollisionEffects
  effects/     signal particles, prompt signal, node pulses, dust, post-processing
  simulation/  graph data, activity buffers, prompt simulation, deterministic signal timeline
  store/       zustand (UI state) + runtime (per-frame mutable state)
  ui/          HUD, prompt console, node info, settings, overlays
  materials/   shared materials, shaders, procedural canvas textures
```

Full details are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Art direction is in [docs/VISUAL_GUIDE.md](docs/VISUAL_GUIDE.md).

## Third-party code and licenses

| Source | License | Use |
|---|---|---|
| [WebGL Shader Lab](https://github.com/PSCactux/webgl-shader-lab), © 2026 PSCactux | MIT | `hash21` / `vnoise` / `fbm` GLSL and the Wireframe Terrain vertex/fragment approach are adapted in `src/world/TerrainMaterials.ts` and ported to TS in `src/world/terrainField.ts`. Attribution is in the file headers. The portal shader idea was rewritten from scratch. |
| [react-three-rapier](https://github.com/pmndrs/react-three-rapier), © Poimandres | MIT | Physics. The demos (all-colliders, collision-events, cluster) were studied for collider, event and impulse patterns. No demo code was copied. |
| [Rapier](https://rapier.rs) (`@dimforge/rapier3d-compat`) | Apache-2.0 | Physics engine (dependency) |
| three.js, @react-three/fiber, drei, postprocessing wrappers, zustand | MIT | Rendering and state |
| [postprocessing](https://github.com/pmndrs/postprocessing) | Zlib | Bloom, vignette, tone mapping |
| Google Fonts: Rajdhani, JetBrains Mono | OFL | UI typography (loaded from Google Fonts) |

Reviewed but not used: **r3f-forcegraph / 3d-force-graph** (MIT). Their force simulation and self-managed node objects conflict with a fixed layered layout, walkable highways built from the same data, and a single camera owner. A small instanced renderer on Three.js replaced them. **react-three-fiber-shader-galaxy** was used as a technique reference only (camera-following star sphere, additive point sprites). No files were copied.

## Known limitations

- Prompt processing is simulated (see the honesty note above).
- The terrain is visual only. Gameplay happens on static platforms above it. A static heightfield collider mode exists (`<ProceduralTerrain collision="static" />`), but it disables terrain animation so the collider and the visuals stay matched.
- Off-path floating nodes can't be walked on. *Travel here* lands on the hub in the same layer.
- Pointer lock needs a click. Without it, drag-to-look is the fallback.
- The bundle is about 3.7 MB, mostly Rapier's inlined WASM. Code splitting hasn't been done.
- There's no audio yet.
- Fonts on in-world console screens fall back if Google Fonts hasn't loaded when the textures are drawn.

## Roadmap

1. A backend `TraceSource`: Python + PyTorch + TransformerLens over WebSocket, streaming real tokens, attention patterns and logits into `SignalTrace`.
2. Node interiors (neon-corridor style) loaded on demand for the hub you enter.
3. Chapter 1 story beats and PvE encounters built on the energy pulse and the physics props.
4. Audio: an ambient bed, signal sonification, and impact sounds driven by collision events.
5. Asynchronous and co-op multiplayer (Convex) on top of the shared network state.
