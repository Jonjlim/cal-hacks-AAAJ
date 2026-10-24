import { CameraControls } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import type { FocusTarget } from '@/core/types';
import { useAppStore, useResolvedFocus } from '@/state';
import { cameraPoseFor } from './layout';

/**
 * Smooth camera transitions between focus targets. In guided mode the target follows the
 * active simulation event; any user drag hands control over to explore mode in place.
 */
export function CameraRig() {
  const controls = useRef<CameraControls>(null);
  const nLayers = useAppStore((s) => s.trace.model.nLayers);
  const target = useResolvedFocus();
  const key = JSON.stringify(target);

  useEffect(() => {
    const pose = cameraPoseFor(JSON.parse(key) as FocusTarget, nLayers);
    void controls.current?.setLookAt(...pose.position, ...pose.target, true);
  }, [key, nLayers]);

  return (
    <CameraControls
      ref={controls}
      makeDefault
      smoothTime={0.8}
      minDistance={2.5}
      maxDistance={120}
      maxPolarAngle={Math.PI * 0.495}
      onStart={() => {
        if (useAppStore.getState().mode === 'guided') {
          useAppStore.setState({ mode: 'explore', focus: JSON.parse(key) as FocusTarget });
        }
      }}
    />
  );
}
