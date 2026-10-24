import { useFrame } from '@react-three/fiber';
import {
  ConvexHullCollider,
  RigidBody,
  type CollisionEnterPayload,
  type RapierRigidBody,
} from '@react-three/rapier';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BoxGeometry,
  EdgesGeometry,
  LineBasicMaterial,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  TetrahedronGeometry,
  Vector3,
  type BufferGeometry,
} from 'three';
import { hdr } from '../materials/materials';
import { registerProp } from './PhysicsWorld';
import { spawnImpact } from './CollisionEffects';

/**
 * A pushable "data fragment": dynamic rigid body with a convex-hull collider
 * built from its own mesh. The player's character controller pushes it; the
 * energy pulse throws it; impacts above a threshold flash its edges and emit
 * sparks via CollisionEffects.
 */

export type FragmentShape = 'octa' | 'cube' | 'tetra';

const SHAPES: Record<FragmentShape, BufferGeometry> = {
  octa: new OctahedronGeometry(1, 0),
  cube: new BoxGeometry(1.4, 1.4, 1.4),
  tetra: new TetrahedronGeometry(1.2, 0),
};
const EDGES: Record<FragmentShape, BufferGeometry> = {
  octa: new EdgesGeometry(SHAPES.octa),
  cube: new EdgesGeometry(SHAPES.cube),
  tetra: new EdgesGeometry(SHAPES.tetra),
};
const HULLS: Record<FragmentShape, Float32Array> = {
  octa: SHAPES.octa.attributes.position.array as Float32Array,
  cube: SHAPES.cube.attributes.position.array as Float32Array,
  tetra: SHAPES.tetra.attributes.position.array as Float32Array,
};

const shell = new MeshStandardMaterial({
  color: '#18233f',
  metalness: 0.75,
  roughness: 0.3,
  transparent: true,
  opacity: 0.9,
});

export interface InteractiveFragmentProps {
  position: [number, number, number];
  shape?: FragmentShape;
  size?: number;
  color?: string;
  /** kg per unit volume — heavier fragments resist pushes. */
  density?: number;
  friction?: number;
  restitution?: number;
}

export function InteractiveFragment({
  position,
  shape = 'octa',
  size = 1,
  color = '#43CDFF',
  density = 1.2,
  friction = 0.7,
  restitution = 0.15,
}: InteractiveFragmentProps) {
  const body = useRef<RapierRigidBody>(null);
  const flash = useRef(0);
  const home = useMemo(() => new Vector3(...position), [position]);
  const tmp = useMemo(() => new Vector3(), []);

  const mats = useMemo(
    () => ({
      edge: new LineBasicMaterial({ color: hdr(color, 2.5), toneMapped: false, transparent: true, blending: AdditiveBlending }),
      core: new MeshBasicMaterial({ color: hdr(color, 2.5), toneMapped: false }),
    }),
    [color],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  useEffect(() => {
    if (!body.current) return;
    return registerProp(body.current, { kind: 'fragment', onPulse: () => (flash.current = 1) });
  }, []);

  const onCollisionEnter = (e: CollisionEnterPayload) => {
    const b = body.current;
    if (!b) return;
    const v = b.linvel();
    const speed = Math.hypot(v.x, v.y, v.z);
    if (speed < 3.5) return;
    flash.current = Math.min(1, speed / 12);
    const cp = e.manifold.solverContactPoint(0);
    const n = e.manifold.normal();
    tmp.set(cp?.x ?? b.translation().x, cp?.y ?? b.translation().y, cp?.z ?? b.translation().z);
    spawnImpact(tmp, color, speed / 10, new Vector3(n.x, n.y, n.z).normalize());
  };

  useFrame((_, dt) => {
    const b = body.current;
    if (!b) return;
    flash.current = Math.max(0, flash.current - dt * 2.2);
    const v = b.linvel();
    const motion = Math.min(1, Math.hypot(v.x, v.y, v.z) / 10);
    const k = 1.6 + motion * 2.5 + flash.current * 6;
    mats.edge.color.copy(hdr(color, k));
    mats.core.color.copy(hdr(color, 1.5 + flash.current * 5));
    // Fell off the world: respawn at home.
    if (b.translation().y < -40) {
      b.setTranslation(home, true);
      b.setLinvel({ x: 0, y: 0, z: 0 }, true);
      b.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  });

  return (
    <RigidBody
      ref={body}
      position={position}
      colliders={false}
      linearDamping={0.25}
      angularDamping={0.5}
      onCollisionEnter={onCollisionEnter}
      ccd
    >
      <ConvexHullCollider args={[HULLS[shape]]} scale={[size, size, size]} density={density} friction={friction} restitution={restitution} />
      <group scale={size}>
        <mesh geometry={SHAPES[shape]} material={shell} castShadow />
        <lineSegments geometry={EDGES[shape]} material={mats.edge} scale={1.005} />
        <mesh geometry={SHAPES[shape]} material={mats.core} scale={0.32} />
      </group>
    </RigidBody>
  );
}
