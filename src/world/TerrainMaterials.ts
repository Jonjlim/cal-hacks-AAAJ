import { AdditiveBlending, Color, NormalBlending, ShaderMaterial } from 'three';
import type { TerrainParams } from './terrainField';

/**
 * Terrain shaders adapted from WebGL Shader Lab's Wireframe Terrain
 * (`src/effects/Terrain.tsx`, `src/lib/glsl.ts`), MIT License,
 * Copyright (c) 2026 PSCactux — https://github.com/PSCactux/webgl-shader-lab
 *
 * Changes from the original:
 *  - world-scale uniforms (noise scale, height, valley width) instead of a 60x90 plane
 *  - the valley runs along the network axis (|z|) and the noise scrolls along +X,
 *    the direction signals flow through the network
 *  - horizon fade uses camera distance instead of uv.y (the camera moves freely)
 *  - a third "peak" colour (violet) and an emission multiplier for bloom control
 *  - an optional dark solid underlay pass so the landscape has body
 */

/** Shader Lab's hash21 / vnoise / fbm, verbatim. */
export const SHADER_LAB_FBM = /* glsl */ `
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p = r * p * 2.02;
    a *= 0.5;
  }
  return v;
}
`;

const vertex = /* glsl */ `
uniform float uTime;
uniform float uHeight;
uniform float uNoiseScale;
uniform float uSpeed;
uniform float uValley;
varying float vHeight;
varying float vDist;
varying vec3 vWorld;
${SHADER_LAB_FBM}

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  // The noise scrolls along +X: the landscape flows with the signal.
  vec2 p = vec2(world.x * uNoiseScale + uTime * uSpeed, world.z * uNoiseScale);
  float h = fbm(p) * 6.0 + fbm(p * 3.1) * 1.4;
  // A valley down the network axis so the view can breathe.
  h *= smoothstep(0.0, uValley, abs(world.z));
  vHeight = h;
  world.y += h * uHeight;
  vWorld = world.xyz;
  vDist = distance(world.xyz, cameraPosition);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const wireFragment = /* glsl */ `
uniform vec3 uLow;
uniform vec3 uHigh;
uniform vec3 uPeak;
uniform float uEmission;
uniform float uFadeStart;
uniform float uFadeEnd;
varying float vHeight;
varying float vDist;
varying vec3 vWorld;
void main() {
  float h = clamp(vHeight / 7.0, 0.0, 1.0);
  vec3 color = mix(uLow, uHigh, smoothstep(0.0, 0.7, h));
  color = mix(color, uPeak, smoothstep(0.7, 1.0, h) * 0.6);
  // Fade toward the horizon (replaces Shader Lab's uv.y fade).
  float far = 1.0 - smoothstep(uFadeStart, uFadeEnd, vDist);
  float near = smoothstep(20.0, 120.0, vDist);
  float alpha = (0.18 + h * 0.85) * far * near;
  gl_FragColor = vec4(color * uEmission * alpha, 1.0);
}
`;

const solidFragment = /* glsl */ `
uniform vec3 uFill;
uniform vec3 uHigh;
uniform float uFadeStart;
uniform float uFadeEnd;
varying float vHeight;
varying float vDist;
void main() {
  float h = clamp(vHeight / 7.0, 0.0, 1.0);
  float far = 1.0 - smoothstep(uFadeStart, uFadeEnd, vDist);
  vec3 col = uFill + uHigh * h * 0.05;
  gl_FragColor = vec4(col, 0.9 * far);
}
`;

export interface TerrainLook {
  lowColor: string;
  highColor: string;
  peakColor: string;
  fillColor: string;
  /** Multiplier on wire brightness. Keep ≲1 so terrain stays below node bloom. */
  emission: number;
  fadeStart: number;
  fadeEnd: number;
}

export const DEFAULT_LOOK: TerrainLook = {
  // Shader Lab "teal / blue" palette (#2243e2 → #3ad6aa) pulled toward our cyan/violet.
  lowColor: '#2243e2',
  highColor: '#43CDFF',
  peakColor: '#8A70E9',
  fillColor: '#050a1c',
  emission: 0.72,
  fadeStart: 1400,
  fadeEnd: 3000,
};

function sharedUniforms(p: TerrainParams, look: TerrainLook, time: { value: number }) {
  return {
    uTime: time,
    uHeight: { value: p.height },
    uNoiseScale: { value: p.noiseScale },
    uSpeed: { value: p.speed },
    uValley: { value: p.valley },
    uFadeStart: { value: look.fadeStart },
    uFadeEnd: { value: look.fadeEnd },
    uHigh: { value: new Color(look.highColor) },
  };
}

export function createTerrainWireMaterial(p: TerrainParams, look: TerrainLook, time: { value: number }) {
  return new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: wireFragment,
    uniforms: {
      ...sharedUniforms(p, look, time),
      uLow: { value: new Color(look.lowColor) },
      uPeak: { value: new Color(look.peakColor) },
      uEmission: { value: look.emission },
    },
    wireframe: true,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
}

export function createTerrainSolidMaterial(p: TerrainParams, look: TerrainLook, time: { value: number }) {
  return new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: solidFragment,
    uniforms: {
      ...sharedUniforms(p, look, time),
      uFill: { value: new Color(look.fillColor) },
    },
    transparent: true,
    blending: NormalBlending,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
  });
}
