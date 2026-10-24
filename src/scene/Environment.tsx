import { Grid, Sparkles } from '@react-three/drei';
import { useMemo } from 'react';
import { COLORS } from '@/core/theme';
import { mulberry32 } from '@/sim';
import { GEOMETRY } from './materials';

/** Background megastructure: floor grid, drifting particles, distant wireframe towers for scale. */
export function Environment() {
  const towers = useMemo(() => {
    const rand = mulberry32(42);
    return Array.from({ length: 26 }, () => {
      const side = rand() > 0.5 ? 1 : -1;
      const h = 8 + rand() * 30;
      return {
        position: [(rand() - 0.5) * 140, h / 2, side * (24 + rand() * 40)] as [
          number,
          number,
          number,
        ],
        scale: [2 + rand() * 4, h, 2 + rand() * 4] as [number, number, number],
      };
    });
  }, []);

  return (
    <group>
      <Grid
        position={[0, -0.01, 0]}
        args={[10, 10]}
        infiniteGrid
        cellSize={1}
        cellThickness={0.5}
        cellColor={COLORS.grid}
        sectionSize={6}
        sectionThickness={1}
        sectionColor="#0f6a78"
        fadeDistance={110}
        fadeStrength={1.6}
        followCamera={false}
      />
      <Sparkles
        count={260}
        scale={[120, 22, 60]}
        position={[0, 9, 0]}
        size={2.2}
        speed={0.25}
        color={COLORS.attention}
        opacity={0.5}
      />
      {towers.map((t, i) => (
        <lineSegments key={i} geometry={GEOMETRY.edgesBox} position={t.position} scale={t.scale}>
          <lineBasicMaterial
            color={i % 3 === 0 ? COLORS.attention : COLORS.grid}
            transparent
            opacity={0.35}
          />
        </lineSegments>
      ))}
    </group>
  );
}
