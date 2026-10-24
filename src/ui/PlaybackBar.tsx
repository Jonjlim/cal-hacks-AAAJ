import { useEffect, useRef } from 'react';
import { clock, SPEEDS, useAppStore, usePlaybackStore } from '@/state';

function fmt(t: number) {
  return `${Math.floor(t / 60)}:${Math.floor(t % 60)
    .toString()
    .padStart(2, '0')}`;
}

/** Transport controls. The scrubber follows the clock via rAF, not React state. */
export function PlaybackBar() {
  const playing = usePlaybackStore((s) => s.playing);
  const speed = usePlaybackStore((s) => s.speed);
  const duration = useAppStore((s) => s.timeline.duration);
  const scrub = useRef<HTMLInputElement>(null);
  const time = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (scrub.current && document.activeElement !== scrub.current) {
        scrub.current.value = String(clock.time);
      }
      if (time.current) time.current.textContent = `${fmt(clock.time)} / ${fmt(duration)}`;
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [duration]);

  const pb = usePlaybackStore.getState;

  return (
    <div className="playback" role="toolbar" aria-label="Playback">
      <button className="btn btn--icon" onClick={() => pb().reset()} title="Reset (Home)">
        ⏮
      </button>
      <button
        className="btn btn--icon"
        onClick={() => pb().stepBack()}
        title="Previous operation (←)"
      >
        ◀◀
      </button>
      <button
        className="btn btn--icon btn--play"
        onClick={() => pb().toggle()}
        title="Play / pause (Space)"
        aria-pressed={playing}
      >
        {playing ? '❚❚' : '▶'}
      </button>
      <button
        className="btn btn--icon"
        onClick={() => pb().stepForward()}
        title="Next operation (→)"
      >
        ▶▶
      </button>
      <input
        ref={scrub}
        className="playback__scrub"
        type="range"
        min={0}
        max={duration}
        step={0.01}
        defaultValue={0}
        aria-label="Timeline"
        onInput={(e) => pb().seek(Number((e.target as HTMLInputElement).value))}
      />
      <span ref={time} className="playback__time" />
      <div className="playback__speeds">
        {SPEEDS.map((s) => (
          <button
            key={s}
            className={`btn btn--chip ${s === speed ? 'is-active' : ''}`}
            onClick={() => pb().setSpeed(s)}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}
