import { AdaptiveDpr } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import { COLORS } from '@/core/theme';
import { useAppStore } from '@/state';
import { CameraRig } from './CameraRig';
import { Effects } from './Effects';
import { cameraPoseFor } from './layout';
import { PlaybackDriver } from './PlaybackDriver';
import { World } from './World';

const start = cameraPoseFor({ kind: 'overview' }, 4);

/** The 3D canvas. Public entry point of the scene module. */
export function Experience() {
  const quality = useAppStore((s) => s.quality);
  return (
    <Canvas
      dpr={quality === 'high' ? [1, 1.75] : 1}
      gl={{ antialias: quality === 'low', powerPreference: 'high-performance' }}
      camera={{ fov: 45, near: 0.1, far: 400, position: [start.position[0] - 30, 40, 70] }}
    >
      <color attach="background" args={[COLORS.void]} />
      <fog attach="fog" args={[COLORS.void, 45, 140]} />
      <PlaybackDriver />
      <CameraRig />
      <Suspense fallback={null}>
        <World />
      </Suspense>
      {quality === 'high' && <Effects />}
      <AdaptiveDpr pixelated={false} />
    </Canvas>
  );
}
