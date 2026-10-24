/**
 * CPU twin of the terrain vertex shader (see TerrainMaterials.ts).
 *
 * Noise functions are a line-by-line port of WebGL Shader Lab's
 * `src/lib/glsl.ts` (hash21 / vnoise / fbm), MIT License,
 * Copyright (c) 2026 PSCactux — https://github.com/PSCactux/webgl-shader-lab
 *
 * Keeping the CPU and GPU versions identical lets gameplay code ask "how high
 * is the visible terrain here?" (for placement, or for an optional static
 * heightfield collider) without reading back from the GPU.
 */

export interface TerrainParams {
  /** World units of plane along X and Z. */
  width: number;
  depth: number;
  /** Center of the plane in world space. */
  center: [number, number, number];
  /** World units of displacement per unit of shader height. */
  height: number;
  /** Noise frequency per world unit (Shader Lab used 0.06 on a 60-unit plane). */
  noiseScale: number;
  /** Scroll speed of the noise field (signal "flow" along +X). */
  speed: number;
  /** Half-width of the flat valley the network floats over, in world units. */
  valley: number;
}

export const DEFAULT_TERRAIN: TerrainParams = {
  width: 5600,
  depth: 5200,
  center: [400, -150, 0],
  height: 42,
  noiseScale: 0.0016,
  speed: 0.16,
  valley: 560,
};

const fract = (x: number) => x - Math.floor(x);

function hash21(px: number, py: number): number {
  px = fract(px * 123.34);
  py = fract(py * 456.21);
  const d = px * (px + 45.32) + py * (py + 45.32);
  px += d;
  py += d;
  return fract(px * py);
}

function vnoise(px: number, py: number): number {
  const ix = Math.floor(px);
  const iy = Math.floor(py);
  const fx = px - ix;
  const fy = py - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash21(ix, iy);
  const b = hash21(ix + 1, iy);
  const c = hash21(ix, iy + 1);
  const d = hash21(ix + 1, iy + 1);
  return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
}

/** 5 octaves, each rotated by mat2(0.8, 0.6, -0.6, 0.8) — matches the GLSL. */
export function fbm(px: number, py: number): number {
  let v = 0;
  let a = 0.5;
  for (let i = 0; i < 5; i++) {
    v += a * vnoise(px, py);
    // GLSL mat2(0.8,0.6,-0.6,0.8) * p (column-major)
    const nx = 0.8 * px - 0.6 * py;
    const ny = 0.6 * px + 0.8 * py;
    px = nx * 2.02;
    py = ny * 2.02;
    a *= 0.5;
  }
  return v;
}

function smoothstep(e0: number, e1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Shader-space height (before world scaling) at a world XZ position and time. */
export function terrainShaderHeight(x: number, z: number, time: number, p: TerrainParams = DEFAULT_TERRAIN): number {
  const px = x * p.noiseScale + time * p.speed;
  const pz = z * p.noiseScale;
  let h = fbm(px, pz) * 6 + fbm(px * 3.1, pz * 3.1) * 1.4;
  h *= smoothstep(0, p.valley, Math.abs(z));
  return h;
}

/** World-space Y of the visible terrain surface. */
export function terrainHeight(x: number, z: number, time = 0, p: TerrainParams = DEFAULT_TERRAIN): number {
  return p.center[1] + terrainShaderHeight(x, z, time, p) * p.height;
}
