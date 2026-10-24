# Architecture

## 1. Network data model: one graph, every view

`src/simulation/graphData.ts` builds `GRAPH` once at module load. **Every** network visual reads from it: the walkable decks and highways, node structures, connection tubes, labels, ambient particles, the prompt signal, and the overview. The overview is not a separate map. It's the same scene seen from a different camera pose.

```ts
NetworkNode { id, name, region, layer, position, size, connections, incoming,
              activity, visual: { variant, color, accent, coreScale },
              deck?: { radius, top },            // only main-path nodes
              interaction?: { kind, label, terminal } }
NetworkEdge { index, source, target, sourceIndex, targetIndex, primary, weight }
```

**Layout.** There are 8 layers along +X (150 units apart), sized 1-3-5-5-5-5-3-1, which gives the narrow-wide-narrow shape of a classic feed-forward diagram. The centre node of each layer sits on `z = 0`. It's the *main path*, and it gets a walkable deck. Off-path nodes spread along Z (80 units apart) and float higher. Adjacent layers are fully connected (111 edges). Edges between two path nodes are `primary` and also become highways.

**Curves.** `EDGE_CURVES` holds one shallow quadratic Bézier per edge. Tubes, ambient particles and prompt fragments all sample the *same* curve objects, so a signal visibly rides the line you see.

**Activity.** `networkActivity.ts` holds `Float32Array`s for node and edge activity, plus a pulse queue. They're written by the simulation, particles and abilities, and read in `useFrame` by renderers. They stay outside React and Zustand on purpose: dozens of writes per frame must not trigger re-renders. Activity decays exponentially in one place (`PromptSignal`'s frame loop).

## 2. State: Zustand vs. runtime

| Store | Holds | Why |
|---|---|---|
| `useGameStore` (Zustand) | camera mode, selection, location, prompt status, panels, quality | Low-frequency. The UI re-renders from it. |
| `runtime` (plain object) | player position/velocity, camera orbit angles, teleport requests, checkpoint | Written every frame; read by other frame loops |

## 3. Camera management

`CameraManager` is the **only** code that writes to the camera, and there are no OrbitControls. Every mode is an orbit pose `{ target, yaw, pitch, distance, fov }`:

| Mode | Target | Input |
|---|---|---|
| `EXPLORATION` | player head (critically damped follow, softer on Y) | pointer-lock mouse; drag fallback; wheel distance |
| `NETWORK_OVERVIEW` | network centre | drag orbit, wheel zoom |
| `NODE_FOCUS` | selected node | drag orbit, wheel zoom |
| `TRANSITION` | blend between a start snapshot and the *live* destination pose | none |

`store.requestCamera(mode)` sets `TRANSITION` and bumps `transitionSeq`. The manager snapshots its current pose on the new sequence number, then each frame calls `interpolatePose(from, livePose(dest), t)`:

- **target:** lerp, staggered so a pull-back first rises off the player before swinging to the network centre;
- **distance:** *logarithmic*, so going from 8 to 1050 units feels like planet → solar system → galaxy rather than a linear dolly;
- **yaw:** shortest arc;
- **fov:** a mid-flight `sin(πt)·12°` warp kick.

Frame order is set by mount order: `PlayerController` (inside `PhysicsWorld`) → Rapier step → `CameraManager`. Physics uses `timeStep="vary"`, so there's exactly one step per rendered frame and no interpolation jitter between the kinematic player and the follow camera.

## 4. Node world generation

- `NeuralNetwork.tsx` draws all cores, glass shells, sprocket halos, beams and pick spheres as **five instanced meshes**. Per-instance attributes carry colour, activity and highlight. Halos billboard toward the camera and fade out up close.
- `NeuralNode.tsx` / `NodeStructure.tsx` build per-variant procedural structures from shared unit geometries and shared materials, scaled by `node.size`. Detail beyond the quality preset's distance is hidden.
- `NodeEnvironment.tsx` derives decks (cylinder colliders), consoles, highways (cuboid slab + barrier colliders), instanced barrier segments and instanced pylons **from the graph**. Nothing is hand-placed.
- `NetworkConnections.tsx` merges all 111 tubes into **one** draw call. The vertex shader widens tubes with camera distance (`max(0, d·k − r)`) so they stay readable in the overview without becoming ropes up close. Per-edge activity arrives as a uniform array; selection dims unrelated edges.

## 5. Terrain and physics

`ProceduralTerrain` adapts WebGL Shader Lab's Wireframe Terrain (MIT): a flat plane displaced in the vertex shader by value-noise FBM, with a valley mask and noise scrolling over time. Colour comes from a low→high gradient, and alpha from height and horizon distance.

**Physics/visual sync.** The GPU animates the terrain, so it gets **no** collider by default. All gameplay happens on static decks and bridges above it, the preferred approach from the brief. `terrainField.ts` is a line-by-line TypeScript port of the GLSL noise. Gameplay can ask for the visible height (used to place the city and the route). The optional `collision="static"` mode builds a Rapier `HeightfieldCollider` from that twin, and forces animation speed to 0 so collider and visuals match.

**Dynamic props** (`physics/`):

| Component | Collider | Behaviour |
|---|---|---|
| `InteractiveFragment` | `ConvexHullCollider` from its own mesh | Pushed by the character controller (`setApplyImpulsesToDynamicBodies`); `onCollisionEnter` → flash + sparks |
| `EnergyOrb` | `BallCollider`, restitution 0.88–0.92 (`Max` combine) | Bounces; glow, point light and sparks scale with impact speed |
| `EnergyPulse` (F) | none | `applyImpulse(m·Δv)` on props within 14 units, Δv 3–16 m/s with linear falloff and lift, 1.2 s cooldown |
| `CollisionEffects` | none | Pooled sparks (one `Points`) and shock rings (one instanced mesh) |

The player is a `kinematicPosition` body driven by Rapier's `KinematicCharacterController`. Each frame we pass a desired translation, and Rapier resolves slopes, steps, snap-to-ground and collisions, and pushes dynamic bodies. Dynamic bodies are never positioned by hand, except for the out-of-world reset.

## 6. Signal simulation

```
prompt ──TraceSource.createTrace()──▶ SignalTrace ──▶ SignalController (deterministic timeline) ──▶ PromptSignal (render)
```

- `promptSimulation.ts`: a toy tokenizer (words + punctuation; words over 7 characters split into 4-character `##` subwords), routes through each layer by hash, and causal attention weights from distance plus a hash. `source: 'simulated'`.
- `signalController.ts`: given `time`, there is exactly one state. The input orb falls from the sky to the gate (0–2.6 s). Tokenization bursts into fragments. Each hop is a staggered traversal of the token's edge curve, with continuous orbit offsets at both ends. Fragments morph into icosahedra during embedding. Attention links pulse during the 11.4–14.6 s window. Two transformer hops follow. Fragments converge into the output gate, then the output beam fires. Arrivals bump node activity and queue shock rings, and traversed edges glow gold.
- The HUD stage tracker follows the controller's stage callbacks.

### Simulation vs. real measurements

Nothing in this build measures a model. The `SignalTrace` interface is the seam:

```ts
interface SignalTrace {
  source: 'simulated' | 'model';
  tokens: { text: string; tokenId: number }[];
  routes: string[][];       // token × layer → node id (which region "handles" it)
  attention: number[][];    // token × token weights
  output: { text: string; note: string };
}
interface TraceSource { kind; createTrace(prompt): Promise<SignalTrace> }
```

A future `ModelTraceSource` (WebSocket → Python/PyTorch/TransformerLens) can fill `tokens` from the real tokenizer, `attention` from a chosen head's pattern, and `routes` from activation magnitudes mapped onto visual regions. Until then, every UI surface that shows the prompt carries a **SIMULATED** badge. The visual regions are an artistic grouping of transformer stages. They're not literal neurons.

## 7. Rendering optimisation

- Instancing everywhere it repeats: cores, shells, halos, beams, pickers, barrier blocks and edges, pylons, city towers, asteroids, fragments, pulses, rings.
- All 111 connection tubes are merged into one geometry. Ambient signals, sparks, dust, stars and token glows are each a single `Points` draw.
- Shared unit geometries and module-level materials (`materials.ts`, `NodeStructure.GEO`); one shared `timeUniform`.
- Dust wraps around the camera entirely on the GPU. Sky and stars follow the camera.
- Bloom uses an HDR threshold of 1.0, so only deliberately emissive materials glow. Low quality skips the composer.
- Detail hides by distance per node. Terrain density, particle counts, DPR, MSAA and shadows follow the quality preset. On High, the shadow camera is a 70-unit box that follows the player.
- Resource cleanup: materials and geometries created in components are disposed on unmount.
