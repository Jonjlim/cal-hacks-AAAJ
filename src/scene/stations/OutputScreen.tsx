import { Text } from '@react-three/drei';
import { COLORS } from '@/core/theme';
import { emittedTokens } from '@/sim';
import { useAppStore, useCurrentEvent } from '@/state';
import { FONTS } from '../fonts';
import { STATION_X } from '../layout';
import { GEOMETRY } from '../materials';
import { StationShell } from '../StationShell';

/** The response, assembled one decoded token at a time. */
export function OutputScreen() {
  const event = useCurrentEvent();
  const trace = useAppStore((s) => s.trace);
  const emitted = event ? emittedTokens(trace, event) : [];
  const generated = emitted
    .filter((t) => !t.special)
    .map((t) => t.text)
    .join('');
  const ended = event?.kind === 'generation.stop';

  return (
    <StationShell station="output" x={STATION_X.output} label="OUTPUT" size={[6.5, 3]}>
      <lineSegments geometry={GEOMETRY.edgesBox} scale={[6, 3.2, 0.2]} position={[0, 2, 0]}>
        <lineBasicMaterial color={COLORS.generated} toneMapped={false} />
      </lineSegments>
      <mesh geometry={GEOMETRY.box} scale={[5.9, 3.1, 0.05]} position={[0, 2, -0.08]}>
        <meshBasicMaterial color={COLORS.panel} transparent opacity={0.85} />
      </mesh>
      <Text
        font={FONTS.regular}
        position={[-2.7, 3.35, 0.06]}
        fontSize={0.24}
        maxWidth={5.4}
        lineHeight={1.3}
        anchorX="left"
        anchorY="top"
        color={COLORS.textDim}
      >
        {trace.prompt}
      </Text>
      <Text
        font={FONTS.regular}
        position={[-2.7, 2.55, 0.06]}
        fontSize={0.3}
        maxWidth={5.4}
        lineHeight={1.3}
        anchorX="left"
        anchorY="top"
        color={COLORS.generated}
      >
        {`${generated.trimStart()}${ended ? '' : '_'}`}
      </Text>
    </StationShell>
  );
}
