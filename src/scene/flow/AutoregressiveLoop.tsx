import { Line, Text } from '@react-three/drei';
import { useMemo, useRef, type ComponentRef } from 'react';
import { COLORS } from '@/core/theme';
import { FONTS } from '../fonts';
import { damp, useSimFrame } from '../hooks';
import { LOOP_HEIGHT, loopPoint, PACKET_Y } from '../layout';

/** The arc that feeds each sampled token back in as the next input. */
export function AutoregressiveLoop() {
  const line = useRef<ComponentRef<typeof Line>>(null);
  const level = useRef(0);
  const points = useMemo(
    () =>
      Array.from({ length: 64 }, (_, i) => {
        const [x, y] = loopPoint(i / 63);
        return [x, y, 0] as [number, number, number];
      }),
    [],
  );
  const [apexX] = loopPoint(0.5);

  useSimFrame(({ event, delta }) => {
    const on = event.kind === 'embed' && event.step > 0;
    level.current = damp(level.current, on ? 1 : 0, 6, delta);
    if (line.current) line.current.material.opacity = 0.18 + level.current * 0.82;
  });

  return (
    <group>
      <Line
        ref={line}
        points={points}
        color={COLORS.generated}
        lineWidth={2}
        transparent
        dashed
        dashSize={0.6}
        gapSize={0.35}
        toneMapped={false}
      />
      <Text
        font={FONTS.bold}
        position={[apexX, PACKET_Y + LOOP_HEIGHT + 0.7, 0]}
        fontSize={0.5}
        letterSpacing={0.14}
        color={COLORS.generated}
      >
        AUTOREGRESSIVE LOOP
      </Text>
      <Text
        font={FONTS.regular}
        position={[apexX, PACKET_Y + LOOP_HEIGHT + 0.1, 0]}
        fontSize={0.28}
        color={COLORS.textDim}
      >
        each new token becomes the next input
      </Text>
    </group>
  );
}
