import type { QualityLevel } from '../config/quality';
import { useGameStore } from '../store/useGameStore';

export function SettingsPanel() {
  const open = useGameStore((s) => s.settingsOpen);
  const quality = useGameStore((s) => s.quality);
  const terrain = useGameStore((s) => s.terrainStyle);
  const labels = useGameStore((s) => s.showLabels);
  const s = useGameStore.getState();
  if (!open) return null;
  return (
    <div className="panel settings">
      <header>GRAPHICS</header>
      <label>Quality</label>
      <div className="seg">
        {(['low', 'medium', 'high'] as QualityLevel[]).map((q) => (
          <button key={q} className={q === quality ? 'on' : ''} onClick={() => s.setQuality(q)}>
            {q}
          </button>
        ))}
      </div>
      <small>Low: no bloom, fewer particles · High: shadows, MSAA, dense terrain</small>
      <label>Terrain</label>
      <div className="seg">
        <button className={terrain === 'wireframe' ? 'on' : ''} onClick={() => s.setTerrainStyle('wireframe')}>
          holographic wireframe
        </button>
        <button className={terrain === 'solid' ? 'on' : ''} onClick={() => s.setTerrainStyle('solid')}>
          solid
        </button>
      </div>
      <label>Labels</label>
      <div className="seg">
        <button className={labels ? 'on' : ''} onClick={() => s.toggleLabels()}>
          {labels ? 'shown' : 'hidden'}
        </button>
      </div>
      <button className="primary" onClick={() => s.setSettingsOpen(false)}>
        Done
      </button>
    </div>
  );
}
