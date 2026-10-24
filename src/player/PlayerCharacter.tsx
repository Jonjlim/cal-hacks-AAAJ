import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PALETTE } from '../config/palette';
import { hdr } from '../materials/materials';
import { runtime } from '../store/runtime';

/**
 * Echo — a procedural explorer (no external asset). Silhouette from the
 * purple-world reference: oversized round dark helmet with a glowing cyan
 * ring "eye", chunky armour plates and a big backpack with thrusters.
 * Feet at local y = 0, facing local +Z.
 */

const M = {
  armor: new MeshStandardMaterial({ color: '#33505a', metalness: 0.55, roughness: 0.42 }),
  suit: new MeshStandardMaterial({ color: '#1c2236', metalness: 0.3, roughness: 0.7 }),
  helmet: new MeshStandardMaterial({ color: '#1b2a33', metalness: 0.7, roughness: 0.22 }),
  visor: new MeshStandardMaterial({ color: '#05080f', metalness: 0.95, roughness: 0.08 }),
  glow: new MeshBasicMaterial({ color: hdr(PALETTE.cyan, 4), toneMapped: false }),
  glowWhite: new MeshBasicMaterial({ color: hdr('#dff6ff', 5), toneMapped: false }),
  flame: new MeshBasicMaterial({
    color: hdr(PALETTE.cyan, 3),
    transparent: true,
    opacity: 0.8,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }),
};

const G = {
  torso: new CapsuleGeometry(0.3, 0.32, 6, 16),
  chestPlate: new RoundedBoxGeometry(0.5, 0.42, 0.2, 3, 0.08),
  helmet: new SphereGeometry(0.34, 32, 24),
  // phi = PI/2 faces +Z; the visor spans ±0.3 PI around it, slightly proud of the shell.
  visor: new SphereGeometry(0.348, 32, 16, Math.PI * 0.2, Math.PI * 0.6, Math.PI * 0.3, Math.PI * 0.36),
  helmetBand: new TorusGeometry(0.345, 0.018, 8, 48),
  eyeRing: new TorusGeometry(0.1, 0.022, 8, 32),
  eyeCore: new CylinderGeometry(0.06, 0.06, 0.04, 20),
  limb: new CapsuleGeometry(0.1, 0.36, 4, 10),
  thigh: new CapsuleGeometry(0.12, 0.3, 4, 10),
  boot: new RoundedBoxGeometry(0.22, 0.16, 0.34, 2, 0.05),
  shoulder: new SphereGeometry(0.15, 16, 12),
  pack: new RoundedBoxGeometry(0.56, 0.62, 0.3, 3, 0.1),
  packPlate: new RoundedBoxGeometry(0.42, 0.22, 0.08, 2, 0.04),
  thruster: new CylinderGeometry(0.08, 0.1, 0.22, 16),
  flame: new ConeGeometry(0.075, 0.5, 12, 1, true),
  strip: new RoundedBoxGeometry(0.04, 0.3, 0.04, 1, 0.015),
};

export function PlayerCharacter() {
  const hips = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const torso = useRef<Group>(null);
  const flameL = useRef<Mesh>(null);
  const flameR = useRef<Mesh>(null);
  const phase = useRef(0);
  const amp = useRef(0);

  useFrame((_, dt) => {
    const p = runtime.player;
    const moving = Math.min(1, p.speed / 8.5);
    amp.current += ((p.grounded ? moving : 0.25) - amp.current) * Math.min(1, dt * 10);
    phase.current += dt * (4 + p.speed * 0.55);
    const s = Math.sin(phase.current);
    const a = amp.current;
    const air = p.grounded ? 0 : 1;
    if (legL.current && legR.current) {
      legL.current.rotation.x = s * 0.75 * a - air * 0.5;
      legR.current.rotation.x = -s * 0.75 * a - air * 0.2;
    }
    if (armL.current && armR.current) {
      armL.current.rotation.x = -s * 0.6 * a + air * 0.4;
      armR.current.rotation.x = s * 0.6 * a + air * 0.4;
      armL.current.rotation.z = 0.12 + air * 0.4;
      armR.current.rotation.z = -0.12 - air * 0.4;
    }
    if (hips.current) hips.current.position.y = Math.abs(Math.cos(phase.current)) * 0.06 * a;
    if (torso.current) torso.current.rotation.x = p.sprinting ? 0.22 : 0.04 * a;
    // Thrusters flare when sprinting or airborne.
    const thrust = Math.max(p.sprinting ? 0.8 : 0, air ? 1 : 0) * (0.85 + Math.random() * 0.3);
    for (const fl of [flameL.current, flameR.current]) {
      if (!fl) continue;
      fl.visible = thrust > 0.05;
      fl.scale.set(1, thrust * 1.4, 1);
    }
  });

  const castShadow = useMemo(() => true, []);

  return (
    <group ref={hips}>
      {/* Legs */}
      {([['L', legL, -0.15], ['R', legR, 0.15]] as const).map(([k, ref, x]) => (
        <group key={k} ref={ref} position={[x, 0.86, 0]}>
          <mesh geometry={G.thigh} material={M.suit} position={[0, -0.24, 0]} castShadow={castShadow} />
          <mesh geometry={G.limb} material={M.armor} position={[0, -0.6, 0]} castShadow={castShadow} />
          <mesh geometry={G.strip} material={M.glow} position={[0, -0.58, 0.1]} />
          <mesh geometry={G.boot} material={M.armor} position={[0, -0.8, 0.05]} castShadow={castShadow} />
        </group>
      ))}
      <group ref={torso} position={[0, 0.9, 0]}>
        <mesh geometry={G.torso} material={M.suit} position={[0, 0.38, 0]} castShadow={castShadow} />
        <mesh geometry={G.chestPlate} material={M.armor} position={[0, 0.48, 0.2]} castShadow={castShadow} />
        <mesh geometry={G.strip} material={M.glow} position={[0, 0.44, 0.31]} scale={[1, 0.8, 1]} />
        {/* belt */}
        <mesh geometry={G.helmetBand} material={M.glow} position={[0, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.9, 0.9, 1]} />
        {/* Arms */}
        {([['L', armL, -0.42], ['R', armR, 0.42]] as const).map(([k, ref, x]) => (
          <group key={k} ref={ref} position={[x, 0.66, 0]}>
            <mesh geometry={G.shoulder} material={M.armor} castShadow={castShadow} />
            <mesh geometry={G.limb} material={M.suit} position={[0, -0.3, 0]} castShadow={castShadow} />
            <mesh geometry={G.shoulder} material={M.armor} position={[0, -0.56, 0]} scale={0.6} />
          </group>
        ))}
        {/* Backpack */}
        <group position={[0, 0.48, -0.33]}>
          <mesh geometry={G.pack} material={M.armor} castShadow={castShadow} />
          <mesh geometry={G.packPlate} material={M.suit} position={[0, 0.12, -0.16]} />
          <mesh geometry={G.strip} material={M.glow} position={[-0.12, -0.08, -0.16]} rotation={[0, 0, Math.PI / 2]} />
          <mesh geometry={G.strip} material={M.glow} position={[0.12, -0.08, -0.16]} rotation={[0, 0, Math.PI / 2]} />
          {([-0.16, 0.16] as const).map((x, i) => (
            <group key={x} position={[x, -0.38, -0.02]}>
              <mesh geometry={G.thruster} material={M.suit} />
              <mesh geometry={G.eyeCore} material={M.glowWhite} position={[0, -0.11, 0]} />
              <mesh ref={i ? flameR : flameL} geometry={G.flame} material={M.flame} position={[0, -0.36, 0]} rotation={[Math.PI, 0, 0]} />
            </group>
          ))}
        </group>
        {/* Helmet */}
        <group position={[0, 1.02, 0.02]}>
          <mesh geometry={G.helmet} material={M.helmet} castShadow={castShadow} />
          <mesh geometry={G.visor} material={M.visor} />
          <mesh geometry={G.helmetBand} material={M.armor} rotation={[0, 0, Math.PI / 2]} />
          {/* side ring "eye" (purple-world reference) */}
          {([-1, 1] as const).map((side) => (
            <group key={side} position={[side * 0.34, 0.02, 0]} rotation={[0, (side * Math.PI) / 2, 0]}>
              <mesh geometry={G.eyeRing} material={M.glow} />
              <mesh geometry={G.eyeCore} material={M.glowWhite} rotation={[Math.PI / 2, 0, 0]} />
            </group>
          ))}
          {/* antenna */}
          <mesh geometry={G.strip} material={M.armor} position={[0.18, 0.36, -0.08]} scale={[0.8, 1, 0.8]} />
          <mesh geometry={G.shoulder} material={M.glowWhite} position={[0.18, 0.52, -0.08]} scale={0.25} />
        </group>
      </group>
    </group>
  );
}
