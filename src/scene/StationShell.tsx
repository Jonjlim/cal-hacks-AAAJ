import { Billboard, Text, useCursor } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { COLORS } from '@/core/theme';
import type { FocusTarget, StationId } from '@/core/types';
import { useAppStore } from '@/state';
import { FONTS } from './fonts';
import { damp, useSimFrame } from './hooks';
import { GEOMETRY } from './materials';

interface StationShellProps {
  station: StationId;
  x: number;
  label: string;
  /** Footprint of the base platform [width, depth]. */
  size?: [number, number];
  labelY?: number;
  focus?: FocusTarget;
  children: ReactNode;
}

/**
 * Common wrapper for macro stations: click-to-focus, hover cursor, a floor platform that
 * brightens while this station is active, and a floating label.
 */
export function StationShell({
  station,
  x,
  label,
  size = [5, 5],
  labelY = 4.2,
  focus,
  children,
}: StationShellProps) {
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  const platform = useRef<THREE.LineSegments>(null);
  const glowLevel = useRef(0);

  useSimFrame(({ event, delta }) => {
    const active = event.station === station ? 1 : 0;
    glowLevel.current = damp(glowLevel.current, Math.max(active, hovered ? 0.6 : 0), 6, delta);
    const mat = platform.current?.material as THREE.LineBasicMaterial | undefined;
    if (mat) mat.opacity = 0.25 + glowLevel.current * 0.75;
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    useAppStore.getState().focusOn(focus ?? { kind: 'station', station });
  };

  return (
    <group
      position={[x, 0, 0]}
      onClick={onClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <lineSegments
        ref={platform}
        geometry={GEOMETRY.edgesBox}
        scale={[size[0], 0.08, size[1]]}
        position={[0, 0.04, 0]}
      >
        <lineBasicMaterial color={COLORS.token} transparent opacity={0.3} toneMapped={false} />
      </lineSegments>
      {children}
      <Billboard position={[0, labelY, 0]}>
        <Text
          font={FONTS.bold}
          fontSize={0.42}
          letterSpacing={0.12}
          color={hovered ? COLORS.text : COLORS.textDim}
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Text>
      </Billboard>
    </group>
  );
}
