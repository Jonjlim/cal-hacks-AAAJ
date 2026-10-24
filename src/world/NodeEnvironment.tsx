import { useFrame } from '@react-three/fiber';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import { useEffect, useMemo, useRef } from 'react';
import {
  BoxGeometry,
  CylinderGeometry,
  Euler,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  TorusGeometry,
  Vector3,
  type Texture,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PALETTE } from '../config/palette';
import { MATERIALS, emissive, hdr } from '../materials/materials';
import {
  bridgeColorTexture,
  bridgeEmissiveTexture,
  consoleScreenTexture,
  deckGlowTexture,
  deckTopTexture,
} from '../materials/textures';
import { GRAPH } from '../simulation/graphData';
import { useGameStore } from '../store/useGameStore';
import type { NetworkNode } from '../types/network';

/**
 * Walkable infrastructure generated from the graph: a deck under every path
 * node and a highway for every primary edge. All collision is static and
 * simple (cylinders + cuboids) — the animated terrain below is visual only.
 */

export const BRIDGE_WIDTH = 9;
const BRIDGE_THICKNESS = 1.4;
const BARRIER_HEIGHT = 1.25;
const SEGMENT_LENGTH = 4.2;

const pathNodes = GRAPH.path.map((id) => GRAPH.nodeById.get(id)!);

export interface BridgeSpec {
  start: Vector3;
  end: Vector3;
  length: number;
  quaternion: Quaternion;
  center: Vector3;
  source: NetworkNode;
  target: NetworkNode;
}

export const BRIDGES: BridgeSpec[] = pathNodes.slice(0, -1).map((a, i) => {
  const b = pathNodes[i + 1];
  const dir = new Vector3(b.position[0] - a.position[0], 0, b.position[2] - a.position[2]).normalize();
  const start = new Vector3(a.position[0], a.deck!.top, a.position[2]).addScaledVector(dir, a.deck!.radius - 3);
  const end = new Vector3(b.position[0], b.deck!.top, b.position[2]).addScaledVector(dir, -(b.deck!.radius - 3));
  const v = end.clone().sub(start);
  const length = v.length();
  const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), v.normalize());
  // Centre of the slab: midpoint lowered by half the thickness along local up.
  const up = new Vector3(0, 1, 0).applyQuaternion(quaternion);
  const center = start.clone().add(end).multiplyScalar(0.5).addScaledVector(up, -BRIDGE_THICKNESS / 2);
  return { start, end, length, quaternion, center, source: a, target: b };
});

function eulerTuple(q: Quaternion): [number, number, number] {
  const e = new Euler().setFromQuaternion(q);
  return [e.x, e.y, e.z];
}

export function NodeEnvironment() {
  return (
    <group>
      {pathNodes.map((n) => (
        <Deck key={n.id} node={n} />
      ))}
      {BRIDGES.map((b, i) => (
        <Bridge key={i} spec={b} />
      ))}
      <BarrierSegments />
      <DeckPylons />
    </group>
  );
}

const deckSide = new MeshStandardMaterial({ color: '#1a2238', metalness: 0.8, roughness: 0.35 });
let deckTopMat: MeshStandardMaterial | null = null;
function getDeckTopMaterial() {
  if (!deckTopMat) {
    deckTopMat = new MeshStandardMaterial({
      map: deckTopTexture(),
      emissiveMap: deckGlowTexture(),
      emissive: hdr(PALETTE.cyan, 1.8),
      metalness: 0.4,
      roughness: 0.65,
    });
  }
  return deckTopMat;
}

const deckGeo = new CylinderGeometry(1, 0.94, 2, 72);
const foundationGeo = new CylinderGeometry(0.9, 0.12, 1, 8, 1);
const rimGeo = new TorusGeometry(1, 0.012, 8, 128);
const consoleBase = new RoundedBoxGeometry(2.6, 1.3, 1.4, 3, 0.25);
const consoleScreen = new BoxGeometry(3.4, 1.9, 0.12);
const padGeo = new TorusGeometry(1, 0.06, 6, 64);

function Deck({ node }: { node: NetworkNode }) {
  const { radius, top } = node.deck!;
  const [x, , z] = node.position;
  const material = useMemo(() => [deckSide, getDeckTopMaterial(), MATERIALS.darkMetal], []);
  return (
    <group>
      <RigidBody type="fixed" colliders={false} position={[x, top - 1, z]}>
        <CylinderCollider args={[1, radius]} friction={1} />
      </RigidBody>
      <mesh geometry={deckGeo} material={material} position={[x, top - 1, z]} scale={[radius, 1, radius]} receiveShadow />
      {/* Floating-island foundation (reference: purple world platforms). */}
      <mesh geometry={foundationGeo} material={MATERIALS.darkMetal} position={[x, top - 2 - radius * 0.45, z]} scale={[radius, radius * 0.9, radius]} />
      <mesh geometry={rimGeo} material={MATERIALS.emissiveWhite} position={[x, top + 0.02, z]} rotation={[Math.PI / 2, 0, 0]} scale={radius * 1.0} />
      <mesh geometry={rimGeo} material={emissive(node.visual.color, 2.2)} position={[x, top - 2.2, z]} rotation={[Math.PI / 2, 0, 0]} scale={radius * 0.95} />
      {node.interaction && <Terminal node={node} />}
    </group>
  );
}

function Terminal({ node }: { node: NetworkNode }) {
  const [tx, ty, tz] = node.interaction!.terminal;
  const padMat = useMemo(() => emissive(node.visual.color, 2.5).clone(), [node.visual.color]);
  const screen = useMemo<Texture>(
    () =>
      consoleScreenTexture(
        node.name,
        node.interaction!.kind === 'prompt' ? 'prompt injection port' : GRAPH.regions[node.region].name,
        node.visual.color,
      ),
    [node],
  );
  const screenMat = useMemo(
    () => new MeshStandardMaterial({ color: '#000', emissive: '#ffffff', emissiveMap: screen, emissiveIntensity: 1.6 }),
    [screen],
  );
  useEffect(() => () => screenMat.dispose(), [screenMat]);
  useFrame(({ clock }) => {
    const near = useGameStore.getState().nearbyTerminalId === node.id;
    const k = near ? 2.2 + Math.sin(clock.elapsedTime * 6) * 0.8 : 1;
    padMat.color.copy(hdr(node.visual.color, 1.6 * k));
  });
  return (
    <group position={[tx, ty, tz]}>
      <mesh geometry={consoleBase} material={MATERIALS.darkMetal} position={[0, 0.65, 0]} />
      <mesh geometry={consoleScreen} material={screenMat} position={[0, 2.3, -0.1]} rotation={[-0.35, Math.PI, 0]} />
      <mesh geometry={padGeo} material={padMat} position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]} scale={3.2} />
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.3, 0.8, 0.7]} position={[0, 0.8, 0]} />
      </RigidBody>
    </group>
  );
}

let bridgeTopMats: MeshStandardMaterial[] = [];
function Bridge({ spec }: { spec: BridgeSpec }) {
  const top = useMemo(() => {
    const color = bridgeColorTexture().clone();
    const em = bridgeEmissiveTexture().clone();
    color.needsUpdate = em.needsUpdate = true;
    color.repeat.set(1, spec.length / (BRIDGE_WIDTH * 0.9));
    em.repeat.set(1, spec.length / 12);
    const m = new MeshStandardMaterial({
      map: color,
      emissiveMap: em,
      emissive: hdr(PALETTE.cyan, 1.4),
      metalness: 0.35,
      roughness: 0.7,
    });
    bridgeTopMats.push(m);
    return m;
  }, [spec]);
  useEffect(
    () => () => {
      top.map?.dispose();
      top.emissiveMap?.dispose();
      top.dispose();
      bridgeTopMats = bridgeTopMats.filter((m) => m !== top);
    },
    [top],
  );
  // Chevrons flow toward the output — the direction information travels.
  useFrame((_, dt) => {
    if (top.emissiveMap) top.emissiveMap.offset.y -= dt * 0.35;
  });
  const geo = useMemo(() => new BoxGeometry(BRIDGE_WIDTH, BRIDGE_THICKNESS, spec.length), [spec.length]);
  useEffect(() => () => geo.dispose(), [geo]);
  const mats = useMemo(() => [deckSide, deckSide, top, MATERIALS.darkMetal, deckSide, deckSide], [top]);
  const rot = eulerTuple(spec.quaternion);
  const half = spec.length / 2;
  return (
    <group position={spec.center} rotation={rot}>
      <mesh geometry={geo} material={mats} receiveShadow />
      {/* Under-glow conduit, visible from below and from the overview. */}
      <mesh geometry={GEO_UNDER} material={MATERIALS.emissiveViolet} position={[0, -BRIDGE_THICKNESS / 2 - 0.2, 0]} scale={[1, 1, spec.length]} />
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[BRIDGE_WIDTH / 2, BRIDGE_THICKNESS / 2, half]} friction={1} />
        {/* Side barriers keep the player (and pushed fragments) on the highway. */}
        <CuboidCollider args={[0.45, BARRIER_HEIGHT, half]} position={[BRIDGE_WIDTH / 2 + 0.2, BARRIER_HEIGHT, 0]} />
        <CuboidCollider args={[0.45, BARRIER_HEIGHT, half]} position={[-BRIDGE_WIDTH / 2 - 0.2, BARRIER_HEIGHT, 0]} />
      </RigidBody>
    </group>
  );
}
const GEO_UNDER = new BoxGeometry(0.5, 0.25, 1);

/**
 * Chunky segmented barriers with glowing white edges (reference: green bridge),
 * instanced across every bridge: one draw call for blocks, one for edges.
 */
function BarrierSegments() {
  const blocks = useRef<InstancedMesh>(null);
  const edges = useRef<InstancedMesh>(null);
  const { count, matrices, edgeMatrices, edgeCount } = useMemo(() => {
    const matrices: Matrix4[] = [];
    const edgeMatrices: Matrix4[] = [];
    const o = new Object3D();
    for (const b of BRIDGES) {
      const n = Math.floor(b.length / SEGMENT_LENGTH);
      const local = new Vector3();
      for (let i = 0; i < n; i++) {
        const zLocal = -b.length / 2 + (i + 0.5) * (b.length / n);
        for (const side of [-1, 1]) {
          local.set(side * (BRIDGE_WIDTH / 2 + 0.2), BARRIER_HEIGHT / 2 + BRIDGE_THICKNESS / 2, zLocal);
          o.position.copy(local).applyQuaternion(b.quaternion).add(b.center);
          o.quaternion.copy(b.quaternion);
          o.scale.set(1, 1, 1);
          o.updateMatrix();
          matrices.push(o.matrix.clone());
          // Glowing outline on the top edge and along the inner face (green-bridge reference).
          const blockTop = BARRIER_HEIGHT / 2 + BRIDGE_THICKNESS / 2 + BARRIER_HEIGHT * 0.95;
          local.set(side * (BRIDGE_WIDTH / 2 + 0.2 - 0.36), blockTop - 0.12, zLocal);
          o.position.copy(local).applyQuaternion(b.quaternion).add(b.center);
          o.updateMatrix();
          edgeMatrices.push(o.matrix.clone());
          local.set(side * (BRIDGE_WIDTH / 2 + 0.2 - 0.49), BRIDGE_THICKNESS / 2 + 0.35, zLocal);
          o.position.copy(local).applyQuaternion(b.quaternion).add(b.center);
          o.updateMatrix();
          edgeMatrices.push(o.matrix.clone());
        }
      }
    }
    return { count: matrices.length, matrices, edgeMatrices, edgeCount: edgeMatrices.length };
  }, []);
  const geos = useMemo(
    () => ({
      block: new RoundedBoxGeometry(0.95, BARRIER_HEIGHT * 1.9, (SEGMENT_LENGTH - 0.35), 2, 0.22),
      edge: new BoxGeometry(0.1, 0.1, SEGMENT_LENGTH - 0.8),
    }),
    [],
  );
  useEffect(() => {
    matrices.forEach((m, i) => blocks.current!.setMatrixAt(i, m));
    edgeMatrices.forEach((m, i) => edges.current!.setMatrixAt(i, m));
    blocks.current!.instanceMatrix.needsUpdate = true;
    edges.current!.instanceMatrix.needsUpdate = true;
    blocks.current!.computeBoundingSphere();
    edges.current!.computeBoundingSphere();
  }, [matrices, edgeMatrices]);
  return (
    <>
      <instancedMesh ref={blocks} args={[geos.block, deckSide, count]} receiveShadow castShadow />
      <instancedMesh ref={edges} args={[geos.edge, MATERIALS.emissiveWhite, edgeCount]} />
    </>
  );
}

/** Light pylons around each deck rim, instanced. */
function DeckPylons() {
  const body = useRef<InstancedMesh>(null);
  const tips = useRef<InstancedMesh>(null);
  const angles = [35, 70, 110, 145, 215, 250, 290, 325].map((d) => (d * Math.PI) / 180);
  const count = pathNodes.length * angles.length;
  const geos = useMemo(
    () => ({ body: new BoxGeometry(0.7, 1, 0.7), tip: new BoxGeometry(0.9, 0.5, 0.9) }),
    [],
  );
  useEffect(() => {
    const o = new Object3D();
    let i = 0;
    for (const n of pathNodes) {
      const { radius, top } = n.deck!;
      angles.forEach((a, k) => {
        const h = k % 2 ? 6 : 10;
        const px = n.position[0] + Math.cos(a) * radius * 0.93;
        const pz = n.position[2] + Math.sin(a) * radius * 0.93;
        o.position.set(px, top + h / 2, pz);
        o.rotation.set(0, -a, 0);
        o.scale.set(1, h, 1);
        o.updateMatrix();
        body.current!.setMatrixAt(i, o.matrix);
        o.position.set(px, top + h + 0.25, pz);
        o.scale.set(1, 1, 1);
        o.updateMatrix();
        tips.current!.setMatrixAt(i, o.matrix);
        i++;
      });
    }
    body.current!.instanceMatrix.needsUpdate = tips.current!.instanceMatrix.needsUpdate = true;
    body.current!.computeBoundingSphere();
    tips.current!.computeBoundingSphere();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <instancedMesh ref={body} args={[geos.body, MATERIALS.darkMetal, count]} castShadow />
      <instancedMesh ref={tips} args={[geos.tip, MATERIALS.emissiveCyan, count]} />
    </>
  );
}
