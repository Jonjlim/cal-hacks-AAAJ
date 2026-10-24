import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { BufferAttribute, Color, Mesh, TubeGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createFlowMaterial } from '../materials/materials';
import { EDGE_CURVES, GRAPH } from '../simulation/graphData';
import { edgeActivity } from '../simulation/networkActivity';
import { useGameStore } from '../store/useGameStore';

/**
 * Every graph edge as a glowing tube, merged into ONE draw call. The same
 * mesh serves exploration (thin light-lines across the sky) and the overview
 * (the shader widens tubes with camera distance).
 */
export function NetworkConnections() {
  const material = useMemo(() => createFlowMaterial(GRAPH.edges.length), []);

  const geometry = useMemo(() => {
    const parts = GRAPH.edges.map((e) => {
      const curve = EDGE_CURVES[e.index];
      const len = curve.getLength();
      const radius = e.primary ? 0.55 : 0.32;
      const tube = new TubeGeometry(curve, Math.max(24, Math.round(len / 5)), radius, 6, false);
      const count = tube.attributes.position.count;
      const uv = tube.attributes.uv;
      const aS = new Float32Array(count);
      const aEdge = new Float32Array(count).fill(e.index);
      const aSrc = new Float32Array(count).fill(e.sourceIndex);
      const aDst = new Float32Array(count).fill(e.targetIndex);
      const aRadius = new Float32Array(count).fill(radius);
      const colors = new Float32Array(count * 3);
      const a = new Color(GRAPH.nodes[e.sourceIndex].visual.color);
      const b = new Color(GRAPH.nodes[e.targetIndex].visual.color);
      const c = new Color();
      const boost = e.primary ? 1.25 : 0.55 + e.weight * 0.45;
      for (let i = 0; i < count; i++) {
        const t = uv.getX(i);
        aS[i] = t * len;
        c.copy(a).lerp(b, t).multiplyScalar(boost);
        colors.set([c.r, c.g, c.b], i * 3);
      }
      tube.setAttribute('aS', new BufferAttribute(aS, 1));
      tube.setAttribute('aEdge', new BufferAttribute(aEdge, 1));
      tube.setAttribute('aSrc', new BufferAttribute(aSrc, 1));
      tube.setAttribute('aDst', new BufferAttribute(aDst, 1));
      tube.setAttribute('aRadius', new BufferAttribute(aRadius, 1));
      tube.setAttribute('color', new BufferAttribute(colors, 3));
      tube.deleteAttribute('uv');
      return tube;
    });
    const merged = mergeGeometries(parts, false)!;
    parts.forEach((p) => p.dispose());
    merged.computeBoundingSphere();
    return merged;
  }, []);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame(() => {
    const u = material.uniforms;
    (u.uEdgeActivity.value as Float32Array).set(edgeActivity);
    const sel = useGameStore.getState().selectedNodeId;
    u.uSelected.value = sel ? GRAPH.nodeById.get(sel)!.index : -1;
  });

  return (
    <mesh
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={2}
      ref={(m: Mesh | null) => m && (m.raycast = () => {})}
    />
  );
}
