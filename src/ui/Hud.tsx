import { useAppStore } from '@/state';
import { Caption } from './Caption';
import { Inspector } from './Inspector';
import { IntroOverlay } from './IntroOverlay';
import { PlaybackBar } from './PlaybackBar';
import { PromptBar } from './PromptBar';
import { StationNav } from './StationNav';
import { TokenStrip } from './TokenStrip';
import { useKeyboard } from './useKeyboard';

/** DOM overlay above the canvas. Public entry point of the UI module. */
export function Hud() {
  useKeyboard();
  const quality = useAppStore((s) => s.quality);
  const setQuality = useAppStore((s) => s.setQuality);

  return (
    <div className="hud">
      <header className="hud__top">
        <div className="brand">
          <span className="brand__mark">◈</span> INSIDE THE MACHINE
        </div>
        <PromptBar />
        <button
          className="btn btn--chip"
          onClick={() => setQuality(quality === 'high' ? 'low' : 'high')}
          title="Toggle bloom / pixel ratio for slower GPUs"
        >
          FX: {quality}
        </button>
      </header>
      <StationNav />
      <Inspector />
      <footer className="hud__bottom">
        <Caption />
        <TokenStrip />
        <PlaybackBar />
      </footer>
      <IntroOverlay />
    </div>
  );
}
