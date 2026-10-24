import { useFrame } from '@react-three/fiber';
import {
  CapsuleCollider,
  RigidBody,
  useRapier,
  type RapierCollider,
  type RapierRigidBody,
} from '@react-three/rapier';
import { useEffect, useRef } from 'react';
import { Group, Vector3 } from 'three';
import { GRAPH } from '../simulation/graphData';
import { heldKeys, runtime } from '../store/runtime';
import { settledMode, useGameStore } from '../store/useGameStore';
import { PlayerCharacter } from './PlayerCharacter';

/**
 * Third-person movement on a Rapier kinematic character controller — the
 * library's intended approach for player bodies: we hand Rapier a desired
 * translation; it resolves slopes, steps, ground snapping and collisions, and
 * applies impulses to dynamic props we walk into (so fragments get pushed by
 * the physics engine, not by hand-written position edits).
 */

export const CAPSULE_HALF = 0.62;
export const CAPSULE_RADIUS = 0.38;
const WALK = 8.5;
const SPRINT = 17;
const JUMP = 11.5;
const GRAVITY = 32;
const FALL_LIMIT = -60;

const D2R = Math.PI / 180;

// Derive the type from the Rapier instance @react-three/rapier actually ships
// (a second, older rapier copy exists only as a @types/three dependency).
type KinematicCharacterController = ReturnType<ReturnType<typeof useRapier>['world']['createCharacterController']>;

export function PlayerController() {
  const body = useRef<RapierRigidBody>(null);
  const collider = useRef<RapierCollider>(null);
  const visual = useRef<Group>(null);
  const controller = useRef<KinematicCharacterController | null>(null);
  const { world } = useRapier();

  const vel = useRef(new Vector3());
  const wish = useRef(new Vector3());
  const tmp = useRef(new Vector3());
  const jumpLatch = useRef(false);
  const coyote = useRef(0);
  const locTimer = useRef(0);

  useEffect(() => {
    const c = world.createCharacterController(0.06);
    c.setUp({ x: 0, y: 1, z: 0 });
    c.enableAutostep(0.55, 0.25, false);
    c.enableSnapToGround(0.6);
    c.setMaxSlopeClimbAngle(50 * D2R);
    c.setMinSlopeSlideAngle(60 * D2R);
    c.setSlideEnabled(true);
    c.setApplyImpulsesToDynamicBodies(true);
    c.setCharacterMass(55);
    controller.current = c;
    return () => {
      world.removeCharacterController(c);
      controller.current = null;
    };
  }, [world]);

  useFrame((_, rawDt) => {
    const b = body.current;
    const col = collider.current;
    const c = controller.current;
    if (!b || !col || !c) return;
    const dt = Math.min(rawDt, 1 / 20);
    const p = runtime.player;

    if (runtime.teleport) {
      b.setNextKinematicTranslation(runtime.teleport);
      p.position.copy(runtime.teleport);
      vel.current.set(0, 0, 0);
      runtime.teleport = null;
      return;
    }

    const s = useGameStore.getState();
    const enabled = s.started && !s.paused && !s.promptOpen && settledMode() === 'EXPLORATION' && s.cameraMode === 'EXPLORATION';

    // --- input -> wish direction in camera space
    let f = 0;
    let r = 0;
    if (enabled) {
      if (heldKeys.has('KeyW') || heldKeys.has('ArrowUp')) f += 1;
      if (heldKeys.has('KeyS') || heldKeys.has('ArrowDown')) f -= 1;
      if (heldKeys.has('KeyD') || heldKeys.has('ArrowRight')) r += 1;
      if (heldKeys.has('KeyA') || heldKeys.has('ArrowLeft')) r -= 1;
    }
    const yaw = runtime.look.yaw;
    const w = wish.current.set(-Math.sin(yaw) * f + Math.cos(yaw) * r, 0, -Math.cos(yaw) * f - Math.sin(yaw) * r);
    if (w.lengthSq() > 1) w.normalize();
    const sprinting = enabled && (heldKeys.has('ShiftLeft') || heldKeys.has('ShiftRight')) && f > 0;
    const speed = sprinting ? SPRINT : WALK;

    // --- horizontal acceleration (smooth start/stop, less control airborne)
    const v = vel.current;
    const rate = p.grounded ? 12 : 3.2;
    const k = 1 - Math.exp(-rate * dt);
    v.x += (w.x * speed - v.x) * k;
    v.z += (w.z * speed - v.z) * k;

    // --- vertical
    coyote.current = p.grounded ? 0.12 : Math.max(0, coyote.current - dt);
    const jumpHeld = enabled && heldKeys.has('Space');
    if (jumpHeld && !jumpLatch.current && coyote.current > 0) {
      v.y = JUMP;
      coyote.current = 0;
    }
    jumpLatch.current = jumpHeld;
    v.y -= GRAVITY * dt;
    if (p.grounded && v.y < 0) v.y = Math.max(v.y, -2);

    const desired = tmp.current.copy(v).multiplyScalar(dt);
    c.computeColliderMovement(col, desired);
    const m = c.computedMovement();
    p.grounded = c.computedGrounded();
    if (p.grounded && v.y < 0) v.y = -0.5;
    // Bonked a ceiling: kill upward velocity.
    if (v.y > 0 && m.y < desired.y * 0.5) v.y = 0;

    const t = b.translation();
    const next = { x: t.x + m.x, y: t.y + m.y, z: t.z + m.z };
    b.setNextKinematicTranslation(next);
    p.position.set(next.x, next.y, next.z);
    p.velocity.set(m.x / dt, m.y / dt, m.z / dt);
    p.speed = Math.hypot(p.velocity.x, p.velocity.z);
    p.sprinting = sprinting && p.speed > WALK + 1;

    // --- facing: turn toward travel direction
    if (w.lengthSq() > 0.01) {
      const target = Math.atan2(w.x, w.z);
      let d = target - p.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      p.facing += d * (1 - Math.exp(-14 * dt));
    }
    if (visual.current) visual.current.rotation.y = p.facing;

    // --- safety net
    if (next.y < FALL_LIMIT) runtime.teleport = runtime.checkpoint.clone();

    // --- location bookkeeping at ~5 Hz (feeds HUD + overview marker)
    locTimer.current -= dt;
    if (locTimer.current <= 0) {
      locTimer.current = 0.2;
      updateLocation(p.position);
    }
  });

  return (
    <RigidBody
      ref={body}
      type="kinematicPosition"
      colliders={false}
      position={runtime.player.position.toArray()}
      enabledRotations={[false, false, false]}
    >
      <CapsuleCollider ref={collider} args={[CAPSULE_HALF, CAPSULE_RADIUS]} />
      <group ref={visual} position={[0, -(CAPSULE_HALF + CAPSULE_RADIUS), 0]}>
        <PlayerCharacter />
      </group>
    </RigidBody>
  );
}

function updateLocation(pos: Vector3) {
  const s = useGameStore.getState();
  let nearest = GRAPH.path[0];
  let nearestD = Infinity;
  let onDeck: string | null = null;
  let terminal: string | null = null;
  for (const id of GRAPH.path) {
    const n = GRAPH.nodeById.get(id)!;
    const dx = pos.x - n.position[0];
    const dz = pos.z - n.position[2];
    const d = Math.hypot(dx, dz);
    if (d < nearestD) {
      nearestD = d;
      nearest = id;
    }
    if (n.deck && d < n.deck.radius + 1 && Math.abs(pos.y - n.deck.top - 1) < 4) onDeck = id;
    if (n.interaction) {
      const [tx, ty, tz] = n.interaction.terminal;
      if (Math.hypot(pos.x - tx, pos.z - tz) < 5 && Math.abs(pos.y - ty) < 4) terminal = id;
    }
  }
  if (onDeck !== s.currentNodeId || nearest !== s.nearestNodeId) s.setLocation(onDeck, nearest);
  if (terminal !== s.nearbyTerminalId) s.setNearbyTerminal(terminal);
  if (onDeck) {
    const n = GRAPH.nodeById.get(onDeck)!;
    if (onDeck === GRAPH.path[0]) runtime.checkpoint.set(...GRAPH.spawn);
    else runtime.checkpoint.set(n.position[0] - 10, n.deck!.top + 1.2, n.position[2]);
  }
}
