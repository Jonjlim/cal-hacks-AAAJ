import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Mesh,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { PALETTE } from '../config/palette';
import { GRAPH } from '../simulation/graphData';
import { bumpNode } from '../simulation/networkActivity';
import { heldKeys, runtime } from '../store/runtime';
import { settledMode, useGameStore } from '../store/useGameStore';
import { dynamicProps } from './PhysicsWorld';

/**
 * Energy Pulse (F): a short-range shockwave that applies real Rapier impulses
 * to nearby dynamic props. Foundation for a future combat ability.
 *
 * Impulse = mass * Δv, with Δv falling off linearly with distance and capped,
 * so light and heavy props both get a readable but stable kick.
 */

export const PULSE_RADIUS = 14;
export const PULSE_COOLDOWN = 1.2;
const MAX_DV = 16; // m/s at point blank
const MIN_DV = 3;
const LIFT = 0.45;

export function EnergyPulse() {
  const ring = useRef<Mesh>(null);
  const shell = useRef<Mesh>(null);
  const age = useRef(99);
  const origin = useMemo(() => new Vector3(), []);
  const latch = useRef(false);

  const mats = useMemo(() => {
    const base = {
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
      side: DoubleSide,
      uniforms: { uAlpha: { value: 0 }, uColor: { value: new Color(PALETTE.cyan) } },
    };
    return {
      ring: new ShaderMaterial({
        ...base,
        uniforms: { uAlpha: { value: 0 }, uColor: { value: new Color(PALETTE.cyan) } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform float uAlpha; uniform vec3 uColor; varying vec2 vUv;
          void main(){ float r = length(vUv - 0.5) * 2.0; float band = smoothstep(0.7, 0.95, r) * (1.0 - smoothstep(0.95, 1.0, r));
            gl_FragColor = vec4(uColor * 4.0 * band * uAlpha + vec3(0.6) * band * uAlpha, 1.0); }`,
      }),
      shell: new ShaderMaterial({
        ...base,
        uniforms: { uAlpha: { value: 0 }, uColor: { value: new Color(PALETTE.violet) } },
        vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 wp = modelMatrix * vec4(position,1.0);
          vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
        fragmentShader: `uniform float uAlpha; uniform vec3 uColor; varying vec3 vN; varying vec3 vV;
          void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.0); gl_FragColor = vec4(uColor * 3.0 * f * uAlpha, 1.0); }`,
      }),
    };
  }, []);
  const geos = useMemo(() => ({ ring: new RingGeometry(0, 1, 96), shell: new SphereGeometry(1, 32, 20) }), []);
  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose());
      Object.values(geos).forEach((g) => g.dispose());
    },
    [mats, geos],
  );

  const fire = () => {
    const now = performance.now() / 1000;
    const s = useGameStore.getState();
    if (now < s.pulseReadyAt) return;
    s.setPulseReadyAt(now + PULSE_COOLDOWN);
    origin.copy(runtime.player.position);
    age.current = 0;
    const tmp = new Vector3();
    dynamicProps.forEach((meta, body) => {
      const p = body.translation();
      tmp.set(p.x - origin.x, p.y - origin.y, p.z - origin.z);
      const d = tmp.length();
      if (d > PULSE_RADIUS) return;
      tmp.y = Math.max(tmp.y, 0);
      if (tmp.lengthSq() < 1e-4) tmp.set(0, 1, 0);
      tmp.normalize();
      tmp.y += LIFT;
      tmp.normalize();
      const dv = MIN_DV + (MAX_DV - MIN_DV) * (1 - d / PULSE_RADIUS);
      const m = body.mass();
      body.applyImpulse({ x: tmp.x * dv * m, y: tmp.y * dv * m, z: tmp.z * dv * m }, true);
      body.applyTorqueImpulse({ x: (Math.random() - 0.5) * m * 2, y: (Math.random() - 0.5) * m * 2, z: (Math.random() - 0.5) * m * 2 }, true);
      meta.onPulse?.();
    });
    // The network feels it too: the node you stand on flares.
    const here = s.currentNodeId ?? s.nearestNodeId;
    bumpNode(GRAPH.nodeById.get(here)!.index, 0.6, { color: PALETTE.cyan });
  };

  useFrame((_, dt) => {
    const s = useGameStore.getState();
    const can = s.started && !s.paused && !s.promptOpen && settledMode() === 'EXPLORATION';
    const pressed = can && heldKeys.has('KeyF');
    if (pressed && !latch.current) fire();
    latch.current = pressed;

    age.current += dt;
    const t = Math.min(1, age.current / 0.55);
    const alive = age.current < 0.55;
    if (ring.current && shell.current) {
      ring.current.visible = shell.current.visible = alive;
      if (alive) {
        const r = PULSE_RADIUS * (0.15 + 0.85 * (1 - Math.pow(1 - t, 3)));
        ring.current.position.set(origin.x, origin.y - 0.95, origin.z);
        ring.current.scale.setScalar(r);
        shell.current.position.copy(origin);
        shell.current.scale.setScalar(r * 0.7);
        mats.ring.uniforms.uAlpha.value = 1 - t;
        mats.shell.uniforms.uAlpha.value = (1 - t) * 0.8;
      }
    }
  });

  return (
    <>
      <mesh ref={ring} geometry={geos.ring} material={mats.ring} rotation={[-Math.PI / 2, 0, 0]} visible={false} />
      <mesh ref={shell} geometry={geos.shell} material={mats.shell} visible={false} />
    </>
  );
}
