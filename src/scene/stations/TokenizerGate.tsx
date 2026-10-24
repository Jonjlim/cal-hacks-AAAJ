import { Text } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import type * as THREE from 'three';
import { showToken3D } from '@/core/format';
import { COLORS } from '@/core/theme';
import { useAppStore } from '@/state';
import { FONTS } from '../fonts';
import { damp, useSimFrame } from '../hooks';
import { laneZ, STATION_X } from '../layout';
import { GEOMETRY, glow } from '../materials';
import { StationShell } from '../StationShell';

const BLADES = 12;

/** A rotating cutter ring that splits text into token chips, each tagged with its ID. */
export function TokenizerGate() {
  const trace = useAppStore((s) => s.trace);
  const rotor = useRef<THREE.Group>(null);
  const chips = useRef<(THREE.Group | null)[]>([]);
  const spin = useRef(0.2);
  const total = trace.tokens.length;
  const promptTokens = useMemo(() => trace.tokens.slice(0, trace.promptLength), [trace]);

  useSimFrame(({ event, progress, delta }) => {
    const cutting = event.kind === 'tokenize';
    spin.current = damp(spin.current, cutting ? 4 : 0.25, 3, delta);
    if (rotor.current) rotor.current.rotation.x += spin.current * delta;

    promptTokens.forEach((_, i) => {
      const g = chips.current[i];
      if (!g) return;
      const shown =
        event.step > 0 || event.kind !== 'prompt.received'
          ? event.kind === 'tokenize'
            ? Math.min(1, Math.max(0, progress * 1.6 - i / promptTokens.length))
            : 1
          : 0;
      g.scale.setScalar(shown);
    });
  });

  return (
    <StationShell station="tokenizer" x={STATION_X.tokenizer} label="TOKENIZER" size={[5, 6]}>
      <group ref={rotor} position={[0, 2, 0]}>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[2.2, 0.05, 8, 64]} />
          <meshBasicMaterial color={glow(COLORS.token, 1.6)} toneMapped={false} />
        </mesh>
        {Array.from({ length: BLADES }, (_, i) => {
          const a = (i / BLADES) * Math.PI * 2;
          return (
            <mesh
              key={i}
              geometry={GEOMETRY.box}
              position={[0, Math.cos(a) * 1.6, Math.sin(a) * 1.6]}
              rotation={[a, 0, 0]}
              scale={[0.04, 0.9, 0.12]}
            >
              <meshBasicMaterial color={glow(COLORS.token, 0.9)} toneMapped={false} />
            </mesh>
          );
        })}
      </group>
      {promptTokens.map((tk, i) => (
        <group
          key={`${tk.position}-${tk.id}`}
          ref={(g) => {
            chips.current[i] = g;
          }}
          position={[2.6, 0.08, laneZ(tk.position, total)]}
        >
          {/* Lies along its own lane, tilted toward the camera, so labels read as a list. */}
          <group rotation={[-1.05, 0, 0]}>
            <Text
              font={FONTS.regular}
              fontSize={0.24}
              color={COLORS.text}
              anchorX="left"
              anchorY="middle"
            >
              {showToken3D(tk.text)}
            </Text>
            <Text
              font={FONTS.regular}
              fontSize={0.15}
              position={[1.9, 0, 0]}
              color={COLORS.textDim}
              anchorX="left"
              anchorY="middle"
            >
              {`id ${tk.id}`}
            </Text>
          </group>
        </group>
      ))}
    </StationShell>
  );
}
