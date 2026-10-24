import { useRef } from 'react';
import * as THREE from 'three';
import { COLORS } from '@/core/theme';
import { kvCacheLength } from '@/sim';
import { useAppStore } from '@/state';
import { useSimFrame } from '../hooks';
import { laneZ, opX } from '../layout';
import { GEOMETRY, glow } from '../materials';

const tmp = new THREE.Object3D();
const stored = glow(COLORS.attention, 0.7);
const fresh = glow(COLORS.attention, 2.4);

/**
 * The KV cache made visible: one tile per (layer, position) whose key/value vectors are
 * stored. During decode only one new tile appears per layer — earlier tiles are reused.
 */
export function KVCacheTiles() {
  const trace = useAppStore((s) => s.trace);
  const total = trace.tokens.length;
  const nLayers = trace.model.nLayers;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const lastIndex = useRef(-1);

  useSimFrame(({ index, event, trace: tr }) => {
    const m = mesh.current;
    if (!m || index === lastIndex.current) return;
    lastIndex.current = index;
    let n = 0;
    const step = tr.steps[event.step];
    for (let l = 0; l < nLayers; l++) {
      const len = kvCacheLength(tr, event, l);
      for (let p = 0; p < len; p++) {
        tmp.position.set(opX(l, 'attention') + 0.75, 0.1, laneZ(p, total));
        tmp.scale.set(0.42, 0.06, 0.4);
        tmp.updateMatrix();
        m.setMatrixAt(n, tmp.matrix);
        const isNew = step !== undefined && p >= step.kvCacheBefore && event.layer === l;
        m.setColorAt(n, isNew ? fresh : stored);
        n++;
      }
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[GEOMETRY.box, undefined, Math.max(1, total * nLayers)]}
      key={total * nLayers}
      frustumCulled={false}
    >
      <meshBasicMaterial toneMapped={false} transparent opacity={0.85} />
    </instancedMesh>
  );
}
