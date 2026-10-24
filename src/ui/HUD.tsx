import { useEffect, useState } from 'react';
import { PULSE_COOLDOWN } from '../physics/EnergyPulse';
import { GRAPH } from '../simulation/graphData';
import { useGameStore } from '../store/useGameStore';
import { NodeInfoPanel } from './NodeInfoPanel';
import { Overlays } from './Overlays';
import { PromptPanel, StageTracker } from './PromptPanel';
import { SettingsPanel } from './SettingsPanel';
import { toggleOverview } from '../app/input';
import { runtime } from '../store/runtime';

/** DOM overlay: everything here is plain React reading the Zustand store. */
export function HUD() {
  const started = useGameStore((s) => s.started);
  const mode = useGameStore((s) => s.cameraMode);
  const target = useGameStore((s) => s.transitionTarget);
  const settled = mode === 'TRANSITION' ? target : mode;
  const exploring = settled === 'EXPLORATION';

  return (
    <div className="hud">
      {started && (
        <>
          <TopLeft />
          <TopRight />
          {exploring && mode === 'EXPLORATION' && <Crosshair />}
          {exploring && <InteractHint />}
          {exploring && <PulseMeter />}
          {!exploring && <OverviewHint focus={settled === 'NODE_FOCUS'} />}
          <ControlsHint exploring={exploring} />
          <StageTracker />
          <PromptPanel />
          <NodeInfoPanel />
          <SettingsPanel />
        </>
      )}
      <Overlays />
    </div>
  );
}

function TopLeft() {
  const current = useGameStore((s) => s.currentNodeId);
  const nearest = useGameStore((s) => s.nearestNodeId);
  const visited = useGameStore((s) => s.visited.length);
  const node = GRAPH.nodeById.get(current ?? nearest)!;
  // On a highway: name the hub ahead (the path runs input -> output along +X).
  const ahead = useAheadNode();
  const region = GRAPH.regions[node.region];
  return (
    <div className="panel top-left">
      <div className="brand">INSIDE THE MACHINE</div>
      <div className="loc" style={{ ['--accent' as string]: region.color }}>
        <span className="dot" />
        {current ? (
          <>
            <b>{node.name}</b>
            <small>{region.name}</small>
          </>
        ) : (
          <>
            <b>In transit</b>
            <small>heading to {ahead.name}</small>
          </>
        )}
      </div>
      <div className="meta">
        hubs mapped <b>{visited}</b>/{GRAPH.path.length}
      </div>
    </div>
  );
}

function useAheadNode() {
  const [x, setX] = useState(runtime.player.position.x);
  useEffect(() => {
    const t = setInterval(() => setX(runtime.player.position.x), 250);
    return () => clearInterval(t);
  }, []);
  const next = GRAPH.path.map((id) => GRAPH.nodeById.get(id)!).find((n) => n.position[0] > x + 1);
  return next ?? GRAPH.nodeById.get(GRAPH.path[GRAPH.path.length - 1])!;
}

function TopRight() {
  const setSettingsOpen = useGameStore((s) => s.setSettingsOpen);
  const setPromptOpen = useGameStore((s) => s.setPromptOpen);
  const mode = useGameStore((s) => s.cameraMode);
  return (
    <div className="top-right">
      <button className="chip" onClick={() => setPromptOpen(true)}>
        ⟢ Prompt <kbd>P</kbd>
      </button>
      <button className="chip" onClick={() => toggleOverview()} disabled={mode === 'TRANSITION'}>
        ◎ Network <kbd>Tab</kbd>
      </button>
      <button className="chip icon" onClick={() => setSettingsOpen(true)} aria-label="Settings">
        ⚙
      </button>
    </div>
  );
}

function Crosshair() {
  return <div className="crosshair" />;
}

function InteractHint() {
  const id = useGameStore((s) => s.nearbyTerminalId);
  if (!id) return null;
  const node = GRAPH.nodeById.get(id)!;
  return (
    <div className="interact">
      <kbd>E</kbd> {node.interaction!.label}
    </div>
  );
}

function PulseMeter() {
  const readyAt = useGameStore((s) => s.pulseReadyAt);
  const [now, setNow] = useState(performance.now() / 1000);
  useEffect(() => {
    const t = setInterval(() => setNow(performance.now() / 1000), 100);
    return () => clearInterval(t);
  }, []);
  const remaining = Math.max(0, readyAt - now);
  const pct = 1 - remaining / PULSE_COOLDOWN;
  return (
    <div className={`pulse-meter ${remaining > 0 ? 'cooling' : 'ready'}`}>
      <kbd>F</kbd> Energy pulse
      <span className="bar">
        <i style={{ width: `${Math.min(100, pct * 100)}%` }} />
      </span>
    </div>
  );
}

function OverviewHint({ focus }: { focus: boolean }) {
  return (
    <div className="overview-hint">
      {focus ? 'NODE FOCUS · drag to orbit · click empty space for overview' : 'NETWORK OVERVIEW · drag to orbit · scroll to zoom · click a node'}{' '}
      · <kbd>Tab</kbd> return to Echo
    </div>
  );
}

function ControlsHint({ exploring }: { exploring: boolean }) {
  if (!exploring) return null;
  return (
    <div className="controls">
      <span><kbd>WASD</kbd> move</span>
      <span><kbd>Shift</kbd> boost</span>
      <span><kbd>Space</kbd> jump</span>
      <span><kbd>F</kbd> pulse</span>
      <span><kbd>E</kbd> interact</span>
      <span><kbd>R</kbd> respawn</span>
    </div>
  );
}
