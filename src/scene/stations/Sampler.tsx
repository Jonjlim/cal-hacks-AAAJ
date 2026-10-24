import { Billboard, Text } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { formatProb, showToken3D } from '@/core/format';
import { COLORS } from '@/core/theme';
import { samplingDistribution } from '@/sim';
import { useAppStore, useCurrentEvent } from '@/state';
import { FONTS } from '../fonts';
import { damp, useSimFrame } from '../hooks';
import { STATION_X } from '../layout';
import { GEOMETRY, glow } from '../materials';
import { StationShell } from '../StationShell';

const SHOWN = 8;
const MAX_H = 3.2;
const SPACING = 0.62;

/**
 * Candidate next tokens as pillars. Solid height = probability after temperature/top-k/top-p;
 * wireframe ghost = plain softmax probability. Filtered-out candidates collapse to the floor.
 * While the Sampling Lab has a draft, pillars preview it live.
 */
export function Sampler() {
  const event = useCurrentEvent();
  const trace = useAppStore((s) => s.trace);
  const draft = useAppStore((s) => s.samplingDraft);
  const step = trace.steps[event?.step ?? 0];
  const sampledId = step?.sampled.id;
  const pillars = useRef<(THREE.Mesh | null)[]>([]);

  const candidates = useMemo(() => {
    const all = step?.logits.candidates ?? [];
    if (!draft) return all.slice(0, SHOWN);
    const d = samplingDistribution(
      all.map((c) => c.logit),
      draft,
    );
    return all.slice(0, SHOWN).map((c, i) => ({ ...c, prob: d.probs[i]!, kept: d.kept[i]! }));
  }, [step, draft]);

  useSimFrame(({ event: e, delta }) => {
    const revealed =
      e.kind === 'sample.select' || e.kind === 'detokenize.emit' || e.kind === 'generation.stop';
    const projected = revealed || e.kind === 'lmHead.project' || draft !== null;
    candidates.forEach((c, i) => {
      const m = pillars.current[i];
      if (!m) return;
      const target = projected ? Math.max(0.03, c.prob * MAX_H) : 0.03;
      m.scale.y = damp(m.scale.y, target, 6, delta);
      m.position.y = m.scale.y / 2;
      const chosen = revealed && !draft && c.id === sampledId;
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.color.copy(
        chosen ? glow(COLORS.generated, 2.2) : glow(COLORS.probability, c.kept ? 1.1 : 0.25),
      );
    });
  });

  const offset = ((candidates.length - 1) * SPACING) / 2;

  return (
    <StationShell
      station="sampler"
      x={STATION_X.sampler}
      label="SAMPLER"
      size={[3, 6]}
      labelY={4.6}
    >
      {candidates.map((c, i) => {
        const z = i * SPACING - offset;
        const ghost = Math.max(0.03, c.rawProb * MAX_H);
        return (
          <group key={`${event?.step}-${c.id}`} position={[0, 0, z]}>
            <mesh
              ref={(m) => {
                pillars.current[i] = m;
              }}
              geometry={GEOMETRY.box}
              scale={[0.36, 0.03, 0.36]}
            >
              <meshBasicMaterial toneMapped={false} />
            </mesh>
            <lineSegments
              geometry={GEOMETRY.edgesBox}
              scale={[0.42, ghost, 0.42]}
              position={[0, ghost / 2, 0]}
            >
              <lineBasicMaterial
                color={COLORS.probability}
                transparent
                opacity={0.35}
                toneMapped={false}
              />
            </lineSegments>
            <Billboard position={[0.9, 0.15, 0]}>
              <Text
                font={FONTS.regular}
                fontSize={0.16}
                color={c.kept ? COLORS.text : COLORS.textDim}
                anchorX="left"
              >
                {`${showToken3D(c.text)}  ${formatProb(c.prob)}`}
              </Text>
            </Billboard>
          </group>
        );
      })}
    </StationShell>
  );
}
