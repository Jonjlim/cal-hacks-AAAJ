import { INTRO } from '@/content/onboarding';
import { useAppStore, usePlaybackStore } from '@/state';

export function IntroOverlay() {
  const open = useAppStore((s) => s.introOpen);
  if (!open) return null;

  const enter = () => {
    useAppStore.getState().closeIntro();
    useAppStore.getState().setMode('guided');
    usePlaybackStore.getState().play();
  };

  return (
    <div className="intro" role="dialog" aria-modal="true" aria-labelledby="intro-title">
      <div className="intro__card">
        <div className="intro__eyebrow">Cal Hacks 13.0</div>
        <h1 id="intro-title">{INTRO.title}</h1>
        <p className="intro__subtitle">{INTRO.subtitle}</p>
        {INTRO.body.map((p) => (
          <p key={p}>{p}</p>
        ))}
        <p className="intro__honesty">{INTRO.honesty}</p>
        <dl className="intro__controls">
          {INTRO.controls.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <div className="intro__actions">
          <button className="btn btn--primary btn--lg" onClick={enter} autoFocus>
            Enter the machine ▶
          </button>
          <button className="btn" onClick={() => useAppStore.getState().closeIntro()}>
            Explore freely
          </button>
        </div>
      </div>
    </div>
  );
}
