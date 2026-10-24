import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { COLORS } from '@/core/theme';
import { embeddedCount } from '@/sim';
import { useAppStore } from '@/state';
import { useSimFrame } from '../hooks';
import { laneZ, RESIDUAL_END_X, RESIDUAL_START_X } from '../layout';
import { glow } from '../materials';

const lit = glow(COLORS.token, 0.9);
const unlit = new THREE.Color(COLORS.grid);

/**
 * The residual stream: one lane per token position running through every layer.
 * Lanes light up once their position exists; future positions are faint placeholders.
 */
export function ResidualLanes() {
  const trace = useAppStore((s) => s.trace);
  const total = trace.tokens.length;
  const lastIndex = useRef(-1);

  const geometry = useMemo(() => {
    const pts: number[] = [];
    for (let p = 0; p < total; p++) {
      const z = laneZ(p, total);
      pts.push(RESIDUAL_START_X, 0.05, z, RESIDUAL_END_X, 0.05, z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pts.length), 3));
    return g;
  }, [total]);

  useSimFrame(({ index, event, trace: tr }) => {
    if (index === lastIndex.current) return;
    lastIndex.current = index;
    const n = embeddedCount(tr, event);
    const colors = geometry.getAttribute('color') as THREE.BufferAttribute;
    for (let p = 0; p < total; p++) {
      const c = p < n ? lit : unlit;
      colors.setXYZ(p * 2, c.r, c.g, c.b);
      colors.setXYZ(p * 2 + 1, c.r, c.g, c.b);
    }
    colors.needsUpdate = true;
  });

  return (
    <lineSegments geometry={geometry} key={total}>
      <lineBasicMaterial vertexColors transparent opacity={0.7} toneMapped={false} />
    </lineSegments>
  );
}
