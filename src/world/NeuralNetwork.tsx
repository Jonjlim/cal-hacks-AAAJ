import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createBeamMaterial, createCoreMaterial, createShellMaterial } from '../materials/materials';
import { GRAPH } from '../simulation/graphData';
import { nodeActivity } from '../simulation/networkActivity';
import { smoothstep } from '../simulation/noise';
import { runtime } from '../store/runtime';
import { settledMode, useGameStore } from '../store/useGameStore';
import { NetworkConnections } from './NetworkConnections';
import { NeuralNode } from './NeuralNode';
import { NodeLabels } from './NodeLabels';

/**
 * The whole computational network: connections, instanced node cores and
 * per-node procedural structures. Rendered once and seen from every camera
 * mode — the overview is this same object viewed from far away.
 */
export function NeuralNetwork() {
  return (
    <group>
      <NetworkConnections />
      <NodeCores />
      {GRAPH.nodes.map((n) => (
        <NeuralNode key={n.id} node={n} />
      ))}
      <NodeLabels />
    </group>
  );
}

const N = GRAPH.nodes.length;

function withInstanceAttrs(geo: BufferGeometry, names: [string, number][]) {
  for (const [name, size] of names) {
    geo.setAttribute(name, new InstancedBufferAttribute(new Float32Array(N * size), size));
  }
  return geo;
}

/** Sprocket halo: a ring with outward spikes (reference: green bridge nodes). */
function sprocketGeometry() {
  const parts: BufferGeometry[] = [new TorusGeometry(1, 0.05, 8, 72), new TorusGeometry(0.8, 0.018, 6, 72)];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spike = new ConeGeometry(0.08, 0.3, 6);
    spike.rotateZ(-Math.PI / 2);
    spike.rotateZ(a);
    spike.translate(Math.cos(a) * 1.16, Math.sin(a) * 1.16, 0);
    parts.push(spike);
  }
  const merged = mergeGeometries(parts.map((p) => p.toNonIndexed()))!;
  parts.forEach((p) => p.dispose());
  return merged;
}

function NodeCores() {
  const coreRef = useRef<InstancedMesh>(null);
  const shellRef = useRef<InstancedMesh>(null);
  const haloRef = useRef<InstancedMesh>(null);
  const beamRef = useRef<InstancedMesh>(null);
  const pickRef = useRef<InstancedMesh>(null);

  const res = useMemo(() => {
    const coreGeo = withInstanceAttrs(new SphereGeometry(1, 48, 32), [
      ['aColor', 3],
      ['aActivity', 1],
      ['aHighlight', 1],
    ]);
    const shellGeo = withInstanceAttrs(new SphereGeometry(1, 40, 24), [
      ['aColor', 3],
      ['aActivity', 1],
    ]);
    const beamGeo = new CylinderGeometry(1, 1, 1, 10, 1, true);
    beamGeo.translate(0, 0.5, 0);
    return {
      coreGeo,
      shellGeo,
      haloGeo: sprocketGeometry(),
      beamGeo,
      pickGeo: new SphereGeometry(1, 12, 8),
      coreMat: createCoreMaterial(),
      shellMat: createShellMaterial(),
      haloMat: new MeshBasicMaterial({ color: new Color(2.4, 2.4, 2.4), toneMapped: false }),
      beamMat: createBeamMaterial('#ffffff', 1.1, 0.6),
      pickMat: new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
    };
  }, []);

  useEffect(() => {
    const c = new Color();
    const m = new Matrix4();
    const coreColor = res.coreGeo.getAttribute('aColor') as InstancedBufferAttribute;
    const shellColor = res.shellGeo.getAttribute('aColor') as InstancedBufferAttribute;
    GRAPH.nodes.forEach((n, i) => {
      c.set(n.visual.color);
      coreColor.setXYZ(i, c.r, c.g, c.b);
      shellColor.setXYZ(i, c.r, c.g, c.b);
      haloRef.current!.setColorAt(i, c);
      const [x, y, z] = n.position;
      // Path nodes: beam from core down to the deck. Floating nodes: tall beam through the node.
      if (n.visual.variant === 'gate') {
        // The portal is its own light source; a beam here would envelop the camera.
        m.compose(new Vector3(x, y, z), new Quaternion(), new Vector3(0, 0, 0));
      } else if (n.deck) {
        m.compose(new Vector3(x, n.deck.top, z), new Quaternion(), new Vector3(1.4, y - n.deck.top, 1.4));
      } else {
        m.compose(new Vector3(x, y - 120, z), new Quaternion(), new Vector3(0.35, 170, 0.35));
      }
      beamRef.current!.setMatrixAt(i, m);
      beamRef.current!.setColorAt(i, c);
      const r = n.size * 3;
      m.compose(new Vector3(x, y, z), new Quaternion(), new Vector3(r, r, r));
      pickRef.current!.setMatrixAt(i, m);
    });
    coreColor.needsUpdate = shellColor.needsUpdate = true;
    haloRef.current!.instanceColor!.needsUpdate = true;
    beamRef.current!.instanceMatrix.needsUpdate = true;
    beamRef.current!.instanceColor!.needsUpdate = true;
    pickRef.current!.instanceMatrix.needsUpdate = true;
    beamRef.current!.computeBoundingSphere();
    pickRef.current!.computeBoundingSphere();
  }, [res]);

  useEffect(
    () => () => {
      Object.values(res).forEach((r) => r.dispose());
    },
    [res],
  );

  const dummy = useMemo(() => new Object3D(), []);
  useFrame(({ camera }) => {
    const s = useGameStore.getState();
    const selected = s.selectedNodeId;
    const hovered = s.hoveredNodeId;
    const act = res.coreGeo.getAttribute('aActivity') as InstancedBufferAttribute;
    const hi = res.coreGeo.getAttribute('aHighlight') as InstancedBufferAttribute;
    const shellAct = res.shellGeo.getAttribute('aActivity') as InstancedBufferAttribute;
    GRAPH.nodes.forEach((n, i) => {
      const a = n.activity + nodeActivity[i];
      act.setX(i, a);
      shellAct.setX(i, a);
      hi.setX(i, n.id === selected ? 1 : n.id === hovered ? 0.6 : 0);
      const r = n.size * n.visual.coreScale * (1 + Math.min(a, 2) * 0.06);
      dummy.position.set(...n.position);
      dummy.quaternion.identity();
      dummy.scale.setScalar(r);
      dummy.updateMatrix();
      coreRef.current!.setMatrixAt(i, dummy.matrix);
      dummy.scale.setScalar(r * 1.45);
      dummy.updateMatrix();
      shellRef.current!.setMatrixAt(i, dummy.matrix);
      // Billboard the sprocket halo toward the camera.
      dummy.quaternion.copy(camera.quaternion);
      dummy.rotateZ(performance.now() * 0.0002 * (i % 2 ? 1 : -1));
      // Gates already read as portals: no sprocket halo. Up close the 3D rings
      // carry the silhouette, so the flat billboard fades out.
      const near = smoothstep(n.size * 4, n.size * 10, camera.position.distanceTo(dummy.position));
      dummy.scale.setScalar(n.visual.variant === 'gate' ? 0 : n.size * 1.95 * Math.max(near, 0.0001));
      dummy.updateMatrix();
      haloRef.current!.setMatrixAt(i, dummy.matrix);
    });
    act.needsUpdate = hi.needsUpdate = shellAct.needsUpdate = true;
    coreRef.current!.instanceMatrix.needsUpdate = true;
    shellRef.current!.instanceMatrix.needsUpdate = true;
    haloRef.current!.instanceMatrix.needsUpdate = true;
  });

  const pickable = () => {
    const m = settledMode();
    return m === 'NETWORK_OVERVIEW' || m === 'NODE_FOCUS';
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!pickable() || runtime.dragMoved || e.instanceId === undefined) return;
    e.stopPropagation();
    const node = GRAPH.nodes[e.instanceId];
    const s = useGameStore.getState();
    s.selectNode(node.id);
    runtime.focus.distance = node.size * 9 + 40;
    s.requestCamera('NODE_FOCUS');
  };
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    if (!pickable() || e.instanceId === undefined) return;
    e.stopPropagation();
    useGameStore.getState().hoverNode(GRAPH.nodes[e.instanceId].id);
    document.body.style.cursor = 'pointer';
  };
  const onOut = () => {
    useGameStore.getState().hoverNode(null);
    document.body.style.cursor = '';
  };

  return (
    <group>
      <instancedMesh ref={coreRef} args={[res.coreGeo, res.coreMat, N]} frustumCulled={false} />
      <instancedMesh ref={shellRef} args={[res.shellGeo, res.shellMat, N]} frustumCulled={false} renderOrder={3} />
      <instancedMesh ref={haloRef} args={[res.haloGeo, res.haloMat, N]} frustumCulled={false} />
      <instancedMesh ref={beamRef} args={[res.beamGeo, res.beamMat, N]} renderOrder={4} />
      <instancedMesh
        ref={pickRef}
        args={[res.pickGeo, res.pickMat, N]}
        onClick={onClick}
        onPointerOver={onOver}
        onPointerOut={onOut}
      />
    </group>
  );
}
