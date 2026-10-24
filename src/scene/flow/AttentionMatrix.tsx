import { Text } from '@react-three/drei';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { showToken3D } from '@/core/format';
import { COLORS, HEAD_COLORS } from '@/core/theme';
import { visibleAttention } from '@/sim';
import { useAppStore, useCurrentEvent, useResolvedFocus } from '@/state';
import { FONTS } from '../fonts';
import { ARCH_H, LANE_SPACING, laneZ, opX } from '../layout';
import { GEOMETRY } from '../materials';

const tmp = new THREE.Object3D();
const BOARD_BOTTOM = ARCH_H + 0.8;
const MAX_HEIGHT = 4.2;

/**
 * Micro view: the causal attention matrix for one layer/head, standing above the layer.
 * Each key column sits directly over that key's lane; rows are queries (top = first token).
 * Extrusion and brightness are softmax weights; the dark upper triangle is the causal mask.
 * Each decode step adds exactly one row — earlier rows come from the KV cache.
 */
export function AttentionMatrix() {
  const focus = useResolvedFocus();
  const event = useCurrentEvent();
  const trace = useAppStore((s) => s.trace);
  const head = useAppStore((s) => s.attentionHead);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const total = trace.tokens.length;

  const layer = focus.kind === 'layer' && focus.op === 'attention' ? focus.layer : undefined;

  const data = useMemo(() => {
    if (layer === undefined || !event) return null;
    const visible = visibleAttention(trace, event, layer, head);
    if (!visible) return null;
    const n = visible.rows.length;
    return {
      rows: visible.rows,
      n,
      rowH: Math.min(0.34, MAX_HEIGHT / Math.max(1, n)),
      currentRows: new Set(visible.currentRows),
    };
  }, [layer, event, trace, head]);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m || !data) return;
    const { rows, n, rowH, currentRows } = data;
    const base = new THREE.Color(HEAD_COLORS[head % HEAD_COLORS.length]!);
    const masked = new THREE.Color(COLORS.masked);
    const c = new THREE.Color();
    let k = 0;
    rows.forEach((row, i) => {
      for (let j = 0; j < n; j++) {
        const w = row[j] ?? 0;
        const isMasked = j > i;
        const depth = isMasked ? 0.02 : 0.04 + w * 1.2;
        tmp.position.set(laneZ(j, total), (n - 1 - i) * rowH, depth / 2);
        tmp.scale.set(LANE_SPACING * 0.86, rowH * 0.86, depth);
        tmp.updateMatrix();
        m.setMatrixAt(k, tmp.matrix);
        if (isMasked) c.copy(masked);
        else c.copy(base).multiplyScalar(0.12 + Math.pow(w, 0.6) * (currentRows.has(i) ? 3 : 1.8));
        m.setColorAt(k, c);
        k++;
      }
    });
    m.count = k;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [data, head, total]);

  if (layer === undefined || !data) return null;
  const { n, rowH } = data;
  const height = n * rowH;
  const left = laneZ(0, total) - LANE_SPACING;
  const right = laneZ(n - 1, total);
  const labelSize = Math.min(0.16, rowH * 0.6);
  const tokens = trace.tokens.slice(0, n);

  // Local +x maps to world +z and local +z faces the upstream (-x) camera.
  return (
    <group position={[opX(layer, 'attention'), BOARD_BOTTOM, 0]} rotation={[0, -Math.PI / 2, 0]}>
      <instancedMesh
        ref={mesh}
        args={[GEOMETRY.box, undefined, n * n]}
        key={n}
        frustumCulled={false}
      >
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {tokens.map((t, i) => (
        <Text
          key={`r${i}`}
          font={FONTS.regular}
          fontSize={labelSize}
          position={[right + LANE_SPACING * 0.6, (n - 1 - i) * rowH, 0]}
          anchorX="left"
          anchorY="middle"
          color={data.currentRows.has(i) ? COLORS.text : COLORS.textDim}
        >
          {showToken3D(t.text)}
        </Text>
      ))}
      {tokens.map((t, j) => (
        <Text
          key={`c${j}`}
          font={FONTS.regular}
          fontSize={Math.min(0.16, LANE_SPACING * 0.4)}
          position={[laneZ(j, total), height - rowH / 2 + 0.12, 0]}
          rotation={[0, 0, Math.PI / 2]}
          anchorX="left"
          anchorY="middle"
          color={COLORS.textDim}
        >
          {showToken3D(t.text)}
        </Text>
      ))}
      <Text
        font={FONTS.bold}
        fontSize={0.2}
        letterSpacing={0.08}
        position={[(left + right) / 2, -rowH / 2 - 0.3, 0]}
        color={COLORS.attention}
        anchorX="center"
      >
        {`LAYER ${layer + 1} · HEAD ${head + 1} · rows: queries · columns: keys`}
      </Text>
    </group>
  );
}
