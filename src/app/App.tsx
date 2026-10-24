import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect } from 'react';
import { ACESFilmicToneMapping } from 'three';
import { QUALITY } from '../config/quality';
import { GRAPH } from '../simulation/graphData';
import { runtime } from '../store/runtime';
import { settledMode, useGameStore } from '../store/useGameStore';
import { HUD } from '../ui/HUD';
import { installInput, requestLock, runPrompt, toggleOverview, travelTo } from './input';
import { Scene } from './Scene';
import { dynamicProps } from '../physics/PhysicsWorld';

export default function App() {
  const quality = useGameStore((s) => s.quality);
  const q = QUALITY[quality];

  useEffect(() => installInput(), []);

  // Dev-only automation hook (used for screenshot verification).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __itm: unknown }).__itm = {
      store: useGameStore,
      runtime,
      runPrompt,
      travelTo,
      toggleOverview,
      graph: GRAPH,
      props: dynamicProps,
    };
  }, []);

  return (
    <div className="app">
      <Canvas
        shadows
        dpr={q.dpr}
        camera={{ fov: 58, near: 0.3, far: 9000, position: [GRAPH.spawn[0] - 8, GRAPH.spawn[1] + 3, 0] }}
        gl={{ antialias: !q.bloom, powerPreference: 'high-performance', toneMapping: ACESFilmicToneMapping }}
        onPointerDown={() => {
          const s = useGameStore.getState();
          if (s.started && settledMode() === 'EXPLORATION' && !s.promptOpen) requestLock();
        }}
        onPointerMissed={() => {
          const s = useGameStore.getState();
          const m = settledMode();
          if ((m === 'NETWORK_OVERVIEW' || m === 'NODE_FOCUS') && !runtime.dragMoved && s.selectedNodeId) {
            s.selectNode(null);
            s.requestCamera('NETWORK_OVERVIEW');
          }
        }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
      <HUD />
    </div>
  );
}
