import { Text } from '@react-three/drei';
import { useRef } from 'react';
import type * as THREE from 'three';
import { COLORS } from '@/core/theme';
import { useAppStore } from '@/state';
import { FONTS } from '../fonts';
import { useSimFrame } from '../hooks';
import { STATION_X } from '../layout';
import { GEOMETRY } from '../materials';
import { StationShell } from '../StationShell';

/** Where the prompt lives as raw text before it is tokenized. */
export function InputTerminal() {
  const prompt = useAppStore((s) => s.trace.prompt);
  const text = useRef<THREE.Mesh>(null);

  useSimFrame(({ event, progress }) => {
    // The raw string dissolves as the tokenizer pulls it apart.
    const fade =
      event.step === 0 && event.kind === 'prompt.received'
        ? 1
        : event.step === 0 && event.kind === 'tokenize'
          ? 1 - progress
          : 0.18;
    const mat = text.current?.material as THREE.MeshBasicMaterial | undefined;
    if (mat) mat.opacity = fade;
  });

  return (
    <StationShell station="input" x={STATION_X.input} label="INPUT" size={[6.5, 3]}>
      <lineSegments geometry={GEOMETRY.edgesBox} scale={[6, 3.2, 0.2]} position={[0, 2, 0]}>
        <lineBasicMaterial color={COLORS.token} toneMapped={false} />
      </lineSegments>
      <mesh geometry={GEOMETRY.box} scale={[5.9, 3.1, 0.05]} position={[0, 2, -0.08]}>
        <meshBasicMaterial color={COLORS.panel} transparent opacity={0.85} />
      </mesh>
      <Text
        ref={text}
        font={FONTS.regular}
        position={[0, 2, 0.06]}
        fontSize={0.34}
        maxWidth={5.4}
        lineHeight={1.3}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
        color={COLORS.text}
      >
        {`> ${prompt}`}
        <meshBasicMaterial attach="material" transparent toneMapped={false} />
      </Text>
    </StationShell>
  );
}
