import { useMemo } from 'react';
import { Experience } from '@/scene/Experience';
import { Hud } from '@/ui/Hud';
import { ErrorBoundary } from './ErrorBoundary';

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function SceneFallback({ reason }: { reason: string }) {
  return (
    <div className="scene-fallback" role="status">
      <h2>3D view unavailable</h2>
      <p>{reason}</p>
      <p>
        The walkthrough, inspector and sampling lab still work below. Try enabling hardware
        acceleration, or add <code>?low</code> to the URL.
      </p>
    </div>
  );
}

/** Application shell: 3D scene underneath, DOM HUD on top, each isolated by error boundaries. */
export function App() {
  const webgl = useMemo(hasWebGL, []);
  return (
    <div className="app">
      <div className="app__scene">
        {webgl ? (
          <ErrorBoundary
            fallback={(e) => <SceneFallback reason={`The renderer crashed: ${e.message}`} />}
          >
            <Experience />
          </ErrorBoundary>
        ) : (
          <SceneFallback reason="Your browser did not provide a WebGL context." />
        )}
      </div>
      <ErrorBoundary
        fallback={(e) => (
          <div className="scene-fallback">
            <h2>Interface error</h2>
            <p>{e.message}</p>
            <button className="btn" onClick={() => location.reload()}>
              Reload
            </button>
          </div>
        )}
      >
        <Hud />
      </ErrorBoundary>
    </div>
  );
}
