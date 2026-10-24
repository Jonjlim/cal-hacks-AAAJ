import { useEffect } from 'react';
import { PALETTE } from '../config/palette';
import { travelTo } from '../app/input';
import { GRAPH } from '../simulation/graphData';
import { bumpNode } from '../simulation/networkActivity';
import { runtime } from '../store/runtime';
import { useGameStore } from '../store/useGameStore';

/** Details for the node selected in the overview, or the terminal used with E. */
export function NodeInfoPanel() {
  const selected = useGameStore((s) => s.selectedNodeId);
  const info = useGameStore((s) => s.infoNodeId);
  const mode = useGameStore((s) => s.cameraMode);
  const id = info ?? selected;

  useEffect(() => {
    if (info) bumpNode(GRAPH.nodeById.get(info)!.index, 1, { color: PALETTE.white });
  }, [info]);

  if (!id) return null;
  const node = GRAPH.nodeById.get(id)!;
  const region = GRAPH.regions[node.region];
  const s = useGameStore.getState();
  const close = () => {
    if (info) s.openInfo(null);
    else {
      s.selectNode(null);
      s.requestCamera('NETWORK_OVERVIEW');
    }
  };
  return (
    <div className="panel node-info" style={{ ['--accent' as string]: region.color }}>
      <header>
        <span className="tag">[L{node.layer}]</span>
        <h2>{node.name}</h2>
        <small>{region.name}</small>
      </header>
      <p>{node.description}</p>
      <p className="muted">{region.description}</p>
      <dl>
        <dt>layer</dt>
        <dd>{node.layer} / {GRAPH.layers.length - 1}</dd>
        <dt>inputs</dt>
        <dd>{node.incoming.length}</dd>
        <dt>outputs</dt>
        <dd>{node.connections.length}</dd>
        <dt>walkable</dt>
        <dd>{node.deck ? 'yes — hub deck' : 'floating (lands on hub)'}</dd>
      </dl>
      <div className="actions">
        {!info && mode !== 'TRANSITION' && (
          <>
            <button
              className="ghost"
              onClick={() => {
                runtime.focus.distance = node.size * 9 + 40;
                s.requestCamera('NODE_FOCUS');
              }}
            >
              Focus
            </button>
            <button className="primary" onClick={() => travelTo(node.id)}>
              Travel here
            </button>
          </>
        )}
        <button className="ghost" onClick={close}>
          Close <kbd>Esc</kbd>
        </button>
      </div>
    </div>
  );
}
