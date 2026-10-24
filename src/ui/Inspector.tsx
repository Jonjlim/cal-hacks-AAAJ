import { useState } from 'react';
import { BLOCK_OP_CONTENT, STATION_CONTENT, type Explainer } from '@/content/stations';
import type { BlockOp, FocusTarget } from '@/core/types';
import { useCurrentEvent, useResolvedFocus } from '@/state';
import { AttentionInspector } from './AttentionInspector';
import { ProvenanceBadge } from './ProvenanceBadge';
import { SamplingLab } from './SamplingLab';

interface Resolved {
  explainer: Explainer;
  heading?: string;
  op?: BlockOp;
  layer?: number;
}

function resolve(focus: FocusTarget, eventOp?: BlockOp, eventLayer?: number): Resolved | null {
  if (focus.kind === 'overview') return null;
  if (focus.kind === 'station') return { explainer: STATION_CONTENT[focus.station] };
  const op = focus.op ?? (eventLayer === focus.layer ? eventOp : undefined);
  return op
    ? {
        explainer: BLOCK_OP_CONTENT[op],
        heading: `Layer ${focus.layer + 1}`,
        op,
        layer: focus.layer,
      }
    : {
        explainer: STATION_CONTENT.transformer,
        heading: `Layer ${focus.layer + 1}`,
        layer: focus.layer,
      };
}

/** Contextual explanation for whatever is in focus, with optional technical depth. */
export function Inspector() {
  const focus = useResolvedFocus();
  const event = useCurrentEvent();
  const [collapsed, setCollapsed] = useState(false);
  const r = resolve(focus, event?.op, event?.layer);

  if (!r) {
    return (
      <aside className="inspector inspector--hint">
        <p>
          Click any structure — or pick one on the left — to look inside. Press <kbd>Space</kbd> to
          play.
        </p>
      </aside>
    );
  }

  const { explainer: x } = r;
  const station = focus.kind === 'station' ? focus.station : undefined;

  return (
    <aside className={`inspector ${collapsed ? 'is-collapsed' : ''}`} aria-label="Inspector">
      <header className="inspector__head">
        <div>
          {r.heading && <div className="inspector__eyebrow">{r.heading}</div>}
          <h2>{x.title}</h2>
          <div className="inspector__kicker">{x.kicker}</div>
        </div>
        <button
          className="btn btn--icon"
          onClick={() => setCollapsed(!collapsed)}
          aria-label="Toggle inspector"
        >
          {collapsed ? '▸' : '▾'}
        </button>
      </header>
      {!collapsed && (
        <div className="inspector__body">
          <p>{x.summary}</p>
          {r.op === 'attention' && r.layer !== undefined && <AttentionInspector layer={r.layer} />}
          {station === 'sampler' && <SamplingLab />}
          <details>
            <summary>Technical detail</summary>
            <ul>
              {x.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
            {x.math && <pre className="math">{x.math.join('\n')}</pre>}
          </details>
          <div className="inspector__honesty">
            <ProvenanceBadge provenance={x.provenance} />
            <span>{x.honesty}</span>
          </div>
        </div>
      )}
    </aside>
  );
}
