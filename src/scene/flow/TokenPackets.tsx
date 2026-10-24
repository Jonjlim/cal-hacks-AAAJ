import { useRef } from 'react';
import * as THREE from 'three';
import { COLORS } from '@/core/theme';
import type { SimEvent } from '@/core/types';
import { easeInOut } from '@/sim';
import { useAppStore } from '@/state';
import { useSimFrame } from '../hooks';
import { eventAnchorX, laneZ, loopPoint, PACKET_Y, STATION_X } from '../layout';
import { GEOMETRY, glow } from '../materials';

const tmp = new THREE.Object3D();
const promptColor = glow(COLORS.token, 2.2);
const generatedColor = glow(COLORS.generated, 2.2);

/** Packets converge to the centre line once only the last position matters. */
function laneWeight(kind: SimEvent['kind'], e: number): [number, number] {
  switch (kind) {
    case 'tokenize':
      return [0, e];
    case 'lmHead.project':
      return [1 - e, 1 - e];
    case 'sample.select':
    case 'detokenize.emit':
      return [0, 0];
    default:
      return [1, 1];
  }
}

/**
 * Glowing packets for the token representations being computed *right now*. Positions are
 * a pure function of (event, progress): scrubbing or stepping always shows a coherent frame.
 */
export function TokenPackets() {
  const total = useAppStore((s) => s.trace.tokens.length);
  const mesh = useRef<THREE.InstancedMesh>(null);

  useSimFrame(({ event, index, progress, timeline, trace, elapsed }) => {
    const m = mesh.current;
    if (!m) return;
    let n = 0;
    if (event.kind !== 'prompt.received' && event.kind !== 'generation.stop') {
      const prev = timeline.events[index - 1];
      const fromX = prev && prev.step === event.step ? eventAnchorX(prev) : STATION_X.input;
      const toX = eventAnchorX(event);
      const loop = event.kind === 'embed' && event.step > 0;
      const count = event.positions.length;

      event.positions.forEach((p, i) => {
        const local =
          event.kind === 'tokenize'
            ? THREE.MathUtils.clamp(progress * 1.6 - (i / Math.max(1, count)) * 0.6, 0, 1)
            : progress;
        const e = easeInOut(local);
        const lane = laneZ(p, total);
        let x: number;
        let y: number;
        let z: number;
        if (loop) {
          [x, y] = loopPoint(e);
          z = lane * e;
        } else {
          const [wFrom, wTo] = laneWeight(event.kind, e);
          x = THREE.MathUtils.lerp(fromX, toX, e);
          y = PACKET_Y + (event.op === 'attention' ? Math.sin(progress * Math.PI) * 0.35 : 0);
          z = lane * THREE.MathUtils.lerp(wFrom, wTo, e);
        }
        tmp.position.set(x, y, z);
        tmp.rotation.set(elapsed * 1.3 + p, elapsed * 0.9, 0);
        tmp.scale.setScalar(0.24);
        tmp.updateMatrix();
        m.setMatrixAt(n, tmp.matrix);
        const generated = trace.tokens[p]?.source === 'generated';
        m.setColorAt(n, generated ? generatedColor : promptColor);
        n++;
      });
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[GEOMETRY.box, undefined, Math.max(1, total)]}
      key={total}
      frustumCulled={false}
    >
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
