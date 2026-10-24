import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Vector3 } from 'three';
import { GRAPH } from '../simulation/graphData';
import { settledMode, useGameStore } from '../store/useGameStore';
import { runtime } from '../store/runtime';

/**
 * Holographic mono labels in the style of the network-city reference:
 *   [L2] EMBEDDING LATTICE
 *   embedding · 5 links
 * Overview: every label is shown. Exploration: only nearby labels, faded by distance.
 */
export function NodeLabels() {
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const tmp = new Vector3();

  useFrame(({ camera }) => {
    const s = useGameStore.getState();
    const mode = settledMode();
    const overview = mode === 'NETWORK_OVERVIEW' || mode === 'NODE_FOCUS';
    GRAPH.nodes.forEach((n, i) => {
      const el = refs.current[i];
      if (!el) return;
      let opacity: number;
      if (!s.showLabels || !s.started) opacity = 0;
      // Overview: walkable hubs fully lit, floating nodes quieter unless hovered/selected.
      else if (overview) opacity = n.deck || n.id === s.hoveredNodeId || n.id === s.selectedNodeId ? 1 : 0.45;
      else {
        const d = tmp.set(...n.position).distanceTo(camera.position);
        opacity = d < 30 ? 0 : Math.min(1, (d - 30) / 40) * (1 - Math.min(1, Math.max(0, (d - 260) / 120)));
      }
      el.style.opacity = opacity.toFixed(2);
      el.classList.toggle('selected', n.id === s.selectedNodeId);
      el.classList.toggle('here', n.id === s.nearestNodeId && overview);
      el.classList.toggle('clickable', overview);
      el.classList.toggle('minor', overview && !n.deck);
    });
  });

  return (
    <>
      {GRAPH.nodes.map((n, i) => (
        <Html
          key={n.id}
          position={[n.position[0], n.position[1] + n.size * 2.6 + 3, n.position[2]]}
          center
          zIndexRange={[10, 0]}
        >
          <div
            ref={(el) => {
              refs.current[i] = el;
            }}
            className="node-label"
            style={{ opacity: 0, ['--accent' as string]: n.visual.color }}
            onClick={() => {
              const s = useGameStore.getState();
              const mode = settledMode();
              if (mode !== 'NETWORK_OVERVIEW' && mode !== 'NODE_FOCUS') return;
              s.selectNode(n.id);
              runtime.focus.distance = n.size * 9 + 40;
              s.requestCamera('NODE_FOCUS');
            }}
          >
            <span className="tag">[L{n.layer}]</span> {n.name}
            <small>
              {GRAPH.regions[n.region].name.toLowerCase()} · {n.connections.length + n.incoming.length} links
            </small>
            <em className="here-tag">● YOU ARE HERE</em>
          </div>
        </Html>
      ))}
    </>
  );
}
