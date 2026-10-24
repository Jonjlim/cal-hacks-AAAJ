import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { COLORS } from '@/core/theme';
import { damp, useSimFrame } from '../hooks';
import { STATION_X } from '../layout';
import { StationShell } from '../StationShell';

const RAYS = 72;

/**
 * The unembedding: one hidden vector fans out into a score for every vocabulary entry.
 * Rays stand in for the ~50k logits; their spread conveys "one vector in, a huge list out".
 */
export function LmHead() {
  const material = useRef<THREE.LineBasicMaterial>(null);
  const level = useRef(0);

  const geometry = useMemo(() => {
    const pts: number[] = [];
    for (let i = 0; i < RAYS; i++) {
      const a = (i / (RAYS - 1) - 0.5) * Math.PI * 0.9;
      const len = 2.6 + ((i * 37) % 11) * 0.06;
      pts.push(
        -1.6,
        1.6,
        0,
        -1.6 + Math.cos(a) * len * 0.6 + 1.2,
        1.6 + Math.sin(a) * 1.5,
        Math.sin(a * 3) * 1.2,
      );
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);

  useSimFrame(({ event, delta }) => {
    level.current = damp(level.current, event.kind === 'lmHead.project' ? 1 : 0, 5, delta);
    if (material.current) {
      material.current.opacity = 0.2 + level.current * 0.8;
      material.current.color.set(COLORS.probability).multiplyScalar(0.8 + level.current * 1.6);
    }
  });

  return (
    <StationShell station="lmHead" x={STATION_X.lmHead} label="LM HEAD · LOGITS" size={[5, 4]}>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial
          ref={material}
          color={COLORS.probability}
          transparent
          toneMapped={false}
        />
      </lineSegments>
      <mesh position={[-1.6, 1.6, 0]}>
        <octahedronGeometry args={[0.22, 0]} />
        <meshBasicMaterial
          color={new THREE.Color(COLORS.probability).multiplyScalar(2)}
          toneMapped={false}
        />
      </mesh>
    </StationShell>
  );
}
