import { useEffect, useMemo } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, ShaderMaterial } from 'three';
import { QUALITY } from '../config/quality';
import { timeUniform } from '../materials/materials';
import { rng } from '../simulation/noise';
import { useGameStore } from '../store/useGameStore';

/**
 * Drifting data dust around the camera. Positions wrap inside a box that
 * follows the camera entirely on the GPU — no per-frame CPU work.
 */
const BOX = 240;

export function ParticleField() {
  const quality = useGameStore((s) => s.quality);
  const count = QUALITY[quality].dust;

  const geo = useMemo(() => {
    const r = rng(77);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos.set([r() * BOX, r() * BOX, r() * BOX], i * 3);
      seed[i] = r();
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new BufferAttribute(seed, 1));
    return g;
  }, [count]);

  const mat = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
        uniforms: { uTime: timeUniform, uBox: { value: BOX } },
        vertexShader: /* glsl */ `
          uniform float uTime; uniform float uBox; attribute float aSeed; varying float vA; varying float vSeed;
          void main() {
            vec3 drift = vec3(uTime * (1.5 + aSeed * 2.0), sin(uTime * 0.3 + aSeed * 20.0) * 3.0 + uTime * 0.6, cos(uTime * 0.2 + aSeed * 9.0) * 3.0);
            vec3 p = mod(position + drift - cameraPosition + uBox * 0.5, uBox) - uBox * 0.5 + cameraPosition;
            vec4 mv = viewMatrix * vec4(p, 1.0);
            float d = length(mv.xyz);
            vA = smoothstep(uBox * 0.5, uBox * 0.25, d) * smoothstep(1.5, 6.0, d);
            vSeed = aSeed;
            gl_PointSize = clamp(90.0 / d, 1.0, 5.0) * (0.6 + aSeed);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          varying float vA; varying float vSeed;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.0, d) * vA;
            vec3 c = mix(vec3(0.26, 0.8, 1.0), vec3(0.54, 0.44, 0.91), step(0.7, vSeed));
            gl_FragColor = vec4(c * a * 0.9, 1.0);
          }`,
      }),
    [],
  );

  useEffect(() => () => geo.dispose(), [geo]);
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}
