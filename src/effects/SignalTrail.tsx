import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { BufferAttribute, BufferGeometry, Color, Points, Vector3 } from 'three';
import { QUALITY } from '../config/quality';
import { createSpriteMaterial } from '../materials/materials';
import { EDGE_CURVES, GRAPH } from '../simulation/graphData';
import { bumpNode } from '../simulation/networkActivity';
import { rng } from '../simulation/noise';
import { useGameStore } from '../store/useGameStore';

/**
 * Ambient directional signal particles. Each particle rides an edge curve
 * input -> output; on arrival it nudges the target node's activity and hops
 * onto one of that node's outgoing edges, so flow visibly propagates
 * layer by layer. One Points draw call.
 */
export function SignalTrail() {
  const quality = useGameStore((s) => s.quality);
  const count = QUALITY[quality].signalParticles;
  const ref = useRef<Points>(null);
  const tmp = useMemo(() => new Vector3(), []);

  const sim = useMemo(() => {
    const r = rng(2024);
    const edge = new Int32Array(count);
    const t = new Float32Array(count);
    const speed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      edge[i] = Math.floor(r() * GRAPH.edges.length);
      t[i] = r();
      speed[i] = 0.08 + r() * 0.1;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aColor', new BufferAttribute(new Float32Array(count * 3), 3));
    const scale = new Float32Array(count);
    for (let i = 0; i < count; i++) scale[i] = 0.6 + r() * 0.8;
    geo.setAttribute('aScale', new BufferAttribute(scale, 1));
    const edgeColors = GRAPH.edges.map((e) => new Color(GRAPH.nodes[e.targetIndex].visual.color).lerp(new Color('#ffffff'), 0.45));
    return { edge, t, speed, geo, edgeColors, r };
  }, [count]);

  const mat = useMemo(() => createSpriteMaterial({ size: 1.1, minPx: 2.5, maxPx: 26 }), []);
  useEffect(() => () => sim.geo.dispose(), [sim]);
  useEffect(() => () => mat.dispose(), [mat]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    mat.uniforms.uViewport.value = state.size.height * state.viewport.dpr;
    const pos = sim.geo.attributes.position as BufferAttribute;
    const col = sim.geo.attributes.aColor as BufferAttribute;
    const arr = pos.array as Float32Array;
    const carr = col.array as Float32Array;
    const p = tmp;
    for (let i = 0; i < count; i++) {
      sim.t[i] += sim.speed[i] * dt;
      if (sim.t[i] >= 1) {
        const e = GRAPH.edges[sim.edge[i]];
        bumpNode(e.targetIndex, 0.025);
        const out = GRAPH.outgoing.get(e.target);
        sim.edge[i] = out && out.length
          ? out[Math.floor(sim.r() * out.length)].index
          : GRAPH.outgoing.get(GRAPH.path[0])![Math.floor(sim.r() * 3)].index;
        sim.t[i] = 0;
      }
      EDGE_CURVES[sim.edge[i]].getPoint(sim.t[i], p);
      arr[i * 3] = p.x;
      arr[i * 3 + 1] = p.y;
      arr[i * 3 + 2] = p.z;
      const c = sim.edgeColors[sim.edge[i]];
      carr[i * 3] = c.r * 1.8;
      carr[i * 3 + 1] = c.g * 1.8;
      carr[i * 3 + 2] = c.b * 1.8;
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  });

  return <points ref={ref} geometry={sim.geo} material={mat} frustumCulled={false} renderOrder={5} />;
}
