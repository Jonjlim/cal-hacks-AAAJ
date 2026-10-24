import { Physics, type RapierRigidBody } from '@react-three/rapier';
import type { ReactNode } from 'react';

/**
 * Rapier world for the game. Gameplay surfaces are static colliders; only a
 * handful of dynamic props exist, registered here so abilities (the energy
 * pulse) can find them without scene-graph queries.
 */

export const GRAVITY: [number, number, number] = [0, -30, 0];

/** Dynamic props that respond to the energy pulse. */
export const dynamicProps = new Map<RapierRigidBody, { kind: 'fragment' | 'orb'; onPulse?: () => void }>();

export function registerProp(body: RapierRigidBody, meta: { kind: 'fragment' | 'orb'; onPulse?: () => void }) {
  dynamicProps.set(body, meta);
  return () => {
    dynamicProps.delete(body);
  };
}

export function PhysicsWorld({ children, debug = false }: { children: ReactNode; debug?: boolean }) {
  // "vary" steps once per rendered frame with the real delta: no interpolation
  // jitter between the kinematic player and the follow camera.
  return (
    <Physics gravity={GRAVITY} timeStep="vary" debug={debug}>
      {children}
    </Physics>
  );
}
