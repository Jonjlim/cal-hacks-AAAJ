import {
  AdditiveBlending,
  Color,
  DoubleSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  ShaderMaterial,
} from 'three';
import { ATMOSPHERE, PALETTE } from '../config/palette';

/**
 * Shared material presets. Materials are module singletons so every node,
 * deck and bridge reuses the same GPU programs and uniforms.
 */

/** Multiply a hex colour into HDR range so it crosses the bloom threshold. */
export function hdr(hex: string, intensity: number): Color {
  return new Color(hex).multiplyScalar(intensity);
}

export const MATERIALS = {
  darkMetal: new MeshStandardMaterial({ color: '#141d33', metalness: 0.85, roughness: 0.38 }),
  darkPanel: new MeshStandardMaterial({ color: '#0b1226', metalness: 0.6, roughness: 0.55 }),
  /** Light-grey deck plating (reference: green bridge walkway). */
  deckPlate: new MeshStandardMaterial({ color: '#3a4258', metalness: 0.35, roughness: 0.7 }),
  emissiveCyan: new MeshBasicMaterial({ color: hdr(PALETTE.cyan, 3), toneMapped: false }),
  emissiveViolet: new MeshBasicMaterial({ color: hdr(PALETTE.violet, 3), toneMapped: false }),
  emissiveGold: new MeshBasicMaterial({ color: hdr(PALETTE.gold, 3), toneMapped: false }),
  emissiveWhite: new MeshBasicMaterial({ color: hdr('#d8f4ff', 3.2), toneMapped: false }),
  emissiveMagenta: new MeshBasicMaterial({ color: hdr(PALETTE.magenta, 3), toneMapped: false }),
  glassWall: new MeshBasicMaterial({
    color: hdr(PALETTE.cyan, 0.35),
    transparent: true,
    opacity: 0.18,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  }),
};

const emissiveCache = new Map<string, MeshBasicMaterial>();
/** Cached emissive material for any colour/intensity pair. */
export function emissive(hex: string, intensity = 3): MeshBasicMaterial {
  const key = `${hex}:${intensity}`;
  let m = emissiveCache.get(key);
  if (!m) {
    m = new MeshBasicMaterial({ color: hdr(hex, intensity), toneMapped: false });
    emissiveCache.set(key, m);
  }
  return m;
}

/** Global time uniform shared by every animated shader. */
export const timeUniform = { value: 0 };

export const FOG_GLSL = /* glsl */ `
  vec3 applyFog(vec3 col, float dist) {
    float f = 1.0 - exp(-pow(dist * ${ATMOSPHERE.fogDensity.toFixed(6)}, 2.0));
    return mix(col, vec3(${new Color(ATMOSPHERE.fog).toArray().map((v) => v.toFixed(4)).join(',')}), clamp(f, 0.0, 1.0));
  }
`;

/**
 * Glass orb with swirling plasma inside and a bright rim — the node core.
 * Instanced: per-instance colour, activity and highlight attributes.
 */
export function createCoreMaterial() {
  return new ShaderMaterial({
    uniforms: { uTime: timeUniform },
    toneMapped: false,
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aActivity;
      attribute float aHighlight;
      varying vec3 vN; varying vec3 vV; varying vec3 vColor; varying vec3 vLocal;
      varying float vAct; varying float vHi; varying float vDist;
      void main() {
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        vColor = aColor; vAct = aActivity; vHi = aHighlight; vLocal = position;
        vDist = distance(cameraPosition, wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vN; varying vec3 vV; varying vec3 vColor; varying vec3 vLocal;
      varying float vAct; varying float vHi; varying float vDist;
      void main() {
        float ndv = max(dot(normalize(vN), normalize(vV)), 0.0);
        float rim = pow(1.0 - ndv, 2.2);
        vec3 p = normalize(vLocal);
        // Swirling energy filaments inside the glass.
        float swirl = sin(p.y * 9.0 + uTime * 1.6 + sin(p.x * 7.0 + uTime) * 2.0)
                    * sin(p.z * 8.0 - uTime * 1.2 + cos(p.y * 5.0) * 2.0);
        float fil = smoothstep(0.55, 0.95, abs(swirl));
        float mottled = 0.5 + 0.5 * sin(p.x * 13.0 + p.y * 11.0 + uTime * 0.4) * sin(p.z * 9.0 - uTime * 0.3);
        vec3 inner = vColor * (0.45 + 0.55 * mottled) + vec3(0.9, 0.98, 1.0) * fil * 0.8;
        float energy = 1.2 + vAct * 3.0 + vHi * 1.5;
        vec3 col = inner * energy * (0.55 + 0.45 * ndv) + vColor * rim * (3.2 + vAct * 4.0);
        col += vec3(1.0) * rim * vHi * 2.0;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

/** Fresnel shell around each core: transparent holographic glass. */
export function createShellMaterial() {
  return new ShaderMaterial({
    uniforms: { uTime: timeUniform },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
    vertexShader: /* glsl */ `
      attribute vec3 aColor; attribute float aActivity;
      varying vec3 vN; varying vec3 vV; varying vec3 vColor; varying float vAct; varying vec3 vW;
      void main() {
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        vColor = aColor; vAct = aActivity; vW = position;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vN; varying vec3 vV; varying vec3 vColor; varying float vAct; varying vec3 vW;
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.0);
        float scan = 0.75 + 0.25 * sin(vW.y * 40.0 - uTime * 3.0);
        gl_FragColor = vec4(vColor * f * scan * (1.1 + vAct * 1.6), 1.0);
      }`,
  });
}

/**
 * Glowing connection tubes. Per-vertex: aS (distance along curve), aEdge,
 * aSrc/aDst node indices. Tubes widen with camera distance so they stay
 * readable from the overview without becoming ropes up close.
 */
export function createFlowMaterial(edgeCount: number) {
  return new ShaderMaterial({
    uniforms: {
      uTime: timeUniform,
      uEdgeActivity: { value: new Float32Array(edgeCount) },
      uSelected: { value: -1 },
      uWidthPerDist: { value: 0.0016 },
      uGold: { value: hdr(PALETTE.gold, 1) },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uEdgeActivity[${edgeCount}];
      uniform float uSelected;
      uniform float uWidthPerDist;
      attribute float aS; attribute float aEdge; attribute float aSrc; attribute float aDst; attribute float aRadius;
      varying float vS; varying float vAct; varying vec3 vColor; varying float vSel; varying float vDist; varying float vEdge;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float d = distance(wp.xyz, cameraPosition);
        float extra = max(0.0, d * uWidthPerDist - aRadius);
        wp.xyz += normalize(mat3(modelMatrix) * normal) * extra;
        vS = aS; vEdge = aEdge; vColor = color; vDist = d;
        vAct = uEdgeActivity[int(aEdge + 0.5)];
        vSel = uSelected < 0.0 ? 0.0 : ((abs(aSrc - uSelected) < 0.5 || abs(aDst - uSelected) < 0.5) ? 1.0 : -1.0);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uGold;
      varying float vS; varying float vAct; varying vec3 vColor; varying float vSel; varying float vDist; varying float vEdge;
      void main() {
        float flow = fract(vS / 26.0 - uTime * 0.55 + vEdge * 0.137);
        float comet = pow(1.0 - flow, 8.0);
        float seg = 0.82 + 0.18 * step(0.12, fract(vS / 9.0));
        vec3 col = vColor * (1.05 + comet * 1.6) * seg;
        col = mix(col, uGold * (2.4 + comet * 4.0), clamp(vAct, 0.0, 1.0));
        if (vSel > 0.5) col = col * 1.6 + vec3(0.6);
        if (vSel < -0.5) col *= 0.22;
        float fade = smoothstep(2.0, 14.0, vDist) * (1.0 - smoothstep(2600.0, 4800.0, vDist));
        gl_FragColor = vec4(col * fade, 1.0);
      }`,
    vertexColors: true,
  });
}

/** Soft additive point sprites with a minimum on-screen size. */
export function createSpriteMaterial(opts: { size: number; minPx: number; maxPx?: number }) {
  return new ShaderMaterial({
    uniforms: {
      uSize: { value: opts.size },
      uMinPx: { value: opts.minPx },
      uMaxPx: { value: opts.maxPx ?? 64 },
      uViewport: { value: 1000 },
      uTime: timeUniform,
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uSize; uniform float uMinPx; uniform float uMaxPx; uniform float uViewport;
      attribute vec3 aColor; attribute float aScale;
      varying vec3 vColor;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float px = uSize * aScale * uViewport * projectionMatrix[1][1] * 0.5 / max(-mv.z, 0.001);
        gl_PointSize = clamp(px, uMinPx * aScale, uMaxPx);
        vColor = aColor;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        a = a * a;
        float core = smoothstep(0.18, 0.0, d);
        gl_FragColor = vec4(vColor * a + vec3(core) * 0.8, 1.0);
      }`,
  });
}

/** Vertical light beam with scrolling bands; alpha fades toward both ends. */
export function createBeamMaterial(hex: string, strength = 1.5, speed = 1) {
  return new ShaderMaterial({
    uniforms: { uTime: timeUniform, uColor: { value: hdr(hex, strength) }, uSpeed: { value: speed }, uOpacity: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vTint;
      void main() {
        vUv = uv;
        vec4 p = vec4(position, 1.0);
        vTint = vec3(1.0);
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
        #endif
        #ifdef USE_INSTANCING_COLOR
          vTint = instanceColor;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * p;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uColor; uniform float uSpeed; uniform float uOpacity;
      varying vec2 vUv; varying vec3 vTint;
      void main() {
        float ends = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
        float bands = 0.65 + 0.35 * sin(vUv.y * 40.0 - uTime * 4.0 * uSpeed);
        float edge = 0.55 + 0.45 * pow(abs(sin(vUv.x * 3.14159 * 2.0)), 4.0);
        gl_FragColor = vec4(uColor * vTint * ends * bands * edge * uOpacity, 1.0);
      }`,
  });
}
