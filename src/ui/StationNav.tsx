import { STATION_CONTENT } from '@/content/stations';
import { STATION_ORDER } from '@/core/types';
import { useAppStore, useResolvedFocus } from '@/state';

/** Jump list for free exploration, plus the switch back to the guided journey. */
export function StationNav() {
  const mode = useAppStore((s) => s.mode);
  const nLayers = useAppStore((s) => s.trace.model.nLayers);
  const focus = useResolvedFocus();
  const { focusOn, setMode } = useAppStore.getState();

  const isStation = (id: string) => focus.kind === 'station' && focus.station === id;

  return (
    <nav className="nav" aria-label="Stations">
      <button
        className={`btn btn--nav ${mode === 'guided' ? 'is-active' : ''}`}
        onClick={() => setMode('guided')}
        title="Camera follows the prompt"
      >
        ◉ Follow prompt
      </button>
      <button
        className={`btn btn--nav ${focus.kind === 'overview' ? 'is-current' : ''}`}
        onClick={() => focusOn({ kind: 'overview' })}
      >
        Overview
      </button>
      {STATION_ORDER.map((id) => (
        <div key={id}>
          <button
            className={`btn btn--nav ${isStation(id) ? 'is-current' : ''}`}
            onClick={() => focusOn({ kind: 'station', station: id })}
          >
            {STATION_CONTENT[id].title}
          </button>
          {id === 'transformer' && (
            <div className="nav__layers">
              {Array.from({ length: nLayers }, (_, l) => (
                <button
                  key={l}
                  className={`btn btn--chip ${focus.kind === 'layer' && focus.layer === l ? 'is-active' : ''}`}
                  onClick={() => focusOn({ kind: 'layer', layer: l, op: 'attention' })}
                  title={`Layer ${l + 1} attention`}
                >
                  L{l + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}
