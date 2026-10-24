import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { HEAD_COLORS } from '@/core/theme';
import { useAppStore, useCurrentEvent } from '@/state';
import { useSimFrame } from '../hooks';
import { ARCH_H, laneZ, opX, PACKET_Y } from '../layout';

const SEGMENTS = 12;
const MIN_WEIGHT = 0.03;
const HEAD_SPACING = 0.22;

/**
 * Attention as light: during an attention event, an arc connects every key position to
 * every query position that attends to it. Brightness is the softmax weight. Arcs only
 * ever point from earlier to later lanes — the causal mask, made visible.
 */
export function AttentionArcs() {
  const event = useCurrentEvent();
  const trace = useAppStore((s) => s.trace);
  const focusHead = useAppStore((s) => s.attentionHead);
  const material = useRef<THREE.LineBasicMaterial>(null);
  const active = event?.kind === 'block.attention' && event.layer !== undefined;

  const geometry = useMemo(() => {
    if (!active || !event || event.layer === undefined) return null;
    const layer = trace.steps[event.step]?.layers[event.layer];
    if (!layer) return null;
    const total = trace.tokens.length;
    const nHeads = layer.heads.length;
    const pts: number[] = [];
    const cols: number[] = [];
    const color = new THREE.Color();

    for (const { head, weights } of layer.heads) {
      const x = opX(event.layer, 'attention') + (head - (nHeads - 1) / 2) * HEAD_SPACING;
      const boost = head === focusHead ? 2.6 : 1.3;
      color.set(HEAD_COLORS[head % HEAD_COLORS.length]!);
      weights.forEach((row, b) => {
        const q = event.positions[b]!;
        const zq = laneZ(q, total);
        row.forEach((w, k) => {
          if (w < MIN_WEIGHT) return;
          const zk = laneZ(k, total);
          const peak = Math.min(ARCH_H * 0.92, 0.35 + Math.abs(zq - zk) * 0.45);
          for (let s = 0; s < SEGMENTS; s++) {
            for (const u of [s / SEGMENTS, (s + 1) / SEGMENTS]) {
              pts.push(x, PACKET_Y + Math.sin(Math.PI * u) * peak, THREE.MathUtils.lerp(zk, zq, u));
              const i = Math.min(1, w) * boost * (0.4 + 0.6 * u);
              cols.push(color.r * i, color.g * i, color.b * i);
            }
          }
        });
      });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    return g;
  }, [active, event, trace, focusHead]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  useSimFrame(({ progress }) => {
    if (material.current) {
      material.current.opacity = Math.min(1, progress * 5, (1 - progress) * 6);
    }
  });

  if (!geometry) return null;
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial
        ref={material}
        vertexColors
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  );
}
