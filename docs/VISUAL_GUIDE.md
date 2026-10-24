# Visual Guide

## Reference mapping

| Reference | What we took | Where |
|---|---|---|
| **Green network bridge** (primary) | Wide grey tiled walkway; chunky segmented barriers with glowing white edges; glowing sphere nodes in spiked "sprocket" halos; vertical light beams; links between nodes; a ring-portal tunnel; a hazy teal city below; asteroids; planets | `NodeEnvironment` (bridges, barriers), `NeuralNetwork` (cores, halos, beams), `NodeStructure.Gate`, `Scenery` (cloud city, asteroids), `SkyDome` |
| **Purple network world** | Explorer silhouette (round dark helmet, cyan ring "eye", big backpack); violet sky with a warm horizon glow; large banded planets near the horizon; floating platforms with beams | `PlayerCharacter`, `SkyDome`, deck foundations |
| **Green network city** | Glowing route snaking to a bright horizon destination; concentric ring discs at each hop; mono `[L2] name` labels | `Scenery.GroundRoute`, `DestinationBeacon`, `NodeLabels` |
| **NN diagram** | Layer columns, narrow-wide-narrow shape, full connectivity between adjacent layers | `graphData.ts` layout; overview pose (pitch 0.92) |
| **Neon corridor** | Black surfaces with cyan outlines; glass orbs with swirling cyan/magenta energy | core shader (`createCoreMaterial`), `EnergyOrb`, fragment edge lines |
| **Wireframe terrain** (Shader Lab) | FBM-displaced wireframe, teal→blue gradient, central valley, scrolling animation | `ProceduralTerrain`, `TerrainMaterials` |

## Palette

| Token | Hex | Use |
|---|---|---|
| navy | `#09152D` | page and UI background |
| deep blue | `#10274D` | sky mid band |
| cyan | `#43CDFF` | primary emission, input region, UI accent |
| blue | `#255BCE` | terrain lows, embedding tint |
| violet | `#8A70E9` | attention region, terrain peaks, pulse shell |
| gold | `#F0C477` | **active signals only** (prompt, energised edges, output) |
| white | `#EAF8FF` | edge outlines, hot cores |
| magenta | `#EA6C91` | reserved for warnings |

## Hierarchy (brightest → dimmest)

1. Player details and active gold signals
2. Walkway edges, deck rims, console pads
3. Node cores, halos and links
4. City towers and route
5. Terrain wireframe (`emission 0.72`; fades past 1400 units)
6. Sky, nebula, stars

Bloom only catches HDR values above 1.0. Keep decorative materials below that and reserve it for things that should guide the eye.

## Rules

- Every repeated object is instanced, and every glowing line comes from the shared graph.
- No random scatter: placement comes from the graph, a seeded RNG, or a deliberate list.
- Fog is light (`FogExp2` 0.00055). The horizon must stay readable.
- Gates are landmarks: they're never hidden by LOD and have no billboard halo.
