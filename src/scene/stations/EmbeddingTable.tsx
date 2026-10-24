import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { COLORS } from '@/core/theme';
import { embeddedCount, easeInOut } from '@/sim';
import { useAppStore } from '@/state';
import { useSimFrame } from '../hooks';
import { laneZ, STATION_X } from '../layout';
import { GEOMETRY, glow } from '../materials';
import { StationShell } from '../StationShell';

const ROWS = 36;
const TABLE_H = 3.6;
const BAR_W = 0.16;

const tmp = new THREE.Object3D();
const pos = glow(COLORS.token, 1.4);
const neg = glow(COLORS.mlp, 1.6);

/**
 * The embedding table: one row per vocabulary entry. A lookup highlights the row for each
 * token ID and the token leaves as a short bar chart of (the first few of) its numbers.
 */
export function EmbeddingTable() {
  const trace = useAppStore((s) => s.trace);
  const bars = useRef<THREE.InstancedMesh>(null);
  const cursor = useRef<THREE.Mesh>(null);
  const total = trace.tokens.length;
  const dims = trace.embeddings[0]?.preview.length ?? 0;
  const count = total * dims;

  const rowLines = useMemo(() => {
    const pts: number[] = [];
    for (let i = 0; i <= ROWS; i++) {
      const y = 0.3 + (i / ROWS) * TABLE_H;
      pts.push(-0.9, y, -1.4, -0.9, y, 1.4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);

  useLayoutEffect(() => {
    const mesh = bars.current;
    if (!mesh) return;
    trace.embeddings.forEach((e) => {
      e.preview.forEach((v, d) => {
        const h = Math.min(1.2, Math.abs(v) * 0.45) + 0.02;
        tmp.position.set(
          1.6 + d * (BAR_W + 0.05),
          1.4 + (v >= 0 ? h / 2 : -h / 2),
          laneZ(e.position, total),
        );
        tmp.scale.set(BAR_W, h, BAR_W);
        tmp.updateMatrix();
        mesh.setMatrixAt(e.position * dims + d, tmp.matrix);
        mesh.setColorAt(e.position * dims + d, v >= 0 ? pos : neg);
      });
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [trace, total, dims]);

  useSimFrame(({ event, progress, trace: tr }) => {
    const visible = embeddedCount(tr, event);
    if (bars.current) bars.current.count = visible * dims;
    if (cursor.current) {
      const looking = event.kind === 'embed';
      cursor.current.visible = looking;
      if (looking) {
        const id = tr.tokens[event.positions[0] ?? 0]?.id ?? 0;
        const target = 0.3 + ((id % ROWS) / ROWS) * TABLE_H;
        cursor.current.position.y = THREE.MathUtils.lerp(
          0.3 + TABLE_H,
          target,
          easeInOut(Math.min(1, progress * 2)),
        );
      }
    }
  });

  return (
    <StationShell station="embedding" x={STATION_X.embedding} label="EMBEDDING TABLE" size={[5, 6]}>
      <lineSegments
        geometry={GEOMETRY.edgesBox}
        scale={[1.8, TABLE_H, 2.8]}
        position={[0, 0.3 + TABLE_H / 2, 0]}
      >
        <lineBasicMaterial color={COLORS.token} toneMapped={false} />
      </lineSegments>
      <lineSegments geometry={rowLines}>
        <lineBasicMaterial color={COLORS.token} transparent opacity={0.25} toneMapped={false} />
      </lineSegments>
      <mesh ref={cursor} geometry={GEOMETRY.box} scale={[1.9, 0.08, 2.9]} visible={false}>
        <meshBasicMaterial color={glow(COLORS.token, 2.5)} toneMapped={false} />
      </mesh>
      <instancedMesh
        ref={bars}
        args={[GEOMETRY.box, undefined, Math.max(1, count)]}
        key={count}
        frustumCulled={false}
      >
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </StationShell>
  );
}
