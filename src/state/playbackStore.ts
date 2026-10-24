import { create } from 'zustand';
import { clampTime, eventIndexAt, nextBoundary, prevBoundary } from '@/sim';
import { useAppStore } from './appStore';
import { clock } from './clock';

export const SPEEDS = [0.5, 1, 2, 4] as const;

interface PlaybackState {
  playing: boolean;
  speed: number;
  /**
   * Index of the active timeline event. Coarse-grained: updated only when it changes,
   * so UI can subscribe without re-rendering every frame.
   */
  eventIndex: number;

  play(): void;
  pause(): void;
  toggle(): void;
  setSpeed(speed: number): void;
  seek(time: number): void;
  stepForward(): void;
  stepBack(): void;
  reset(): void;
  /** Called by the scene's PlaybackDriver only. */
  syncEventIndex(index: number): void;
}

const timeline = () => useAppStore.getState().timeline;

export const usePlaybackStore = create<PlaybackState>()((set, get) => ({
  playing: false,
  speed: 1,
  eventIndex: 0,

  play() {
    if (clock.time >= timeline().duration) clock.time = 0;
    set({ playing: true });
  },
  pause: () => set({ playing: false }),
  toggle: () => (get().playing ? get().pause() : get().play()),
  setSpeed: (speed) => set({ speed }),
  seek(time) {
    clock.time = clampTime(timeline(), time);
    set({ eventIndex: eventIndexAt(timeline(), clock.time) });
  },
  stepForward() {
    set({ playing: false });
    get().seek(nextBoundary(timeline(), clock.time));
  },
  stepBack() {
    set({ playing: false });
    get().seek(prevBoundary(timeline(), clock.time));
  },
  reset() {
    set({ playing: false });
    get().seek(0);
  },
  syncEventIndex(index) {
    if (index !== get().eventIndex) set({ eventIndex: index });
  },
}));

// A new trace invalidates the playback position.
useAppStore.subscribe((s, prev) => {
  if (s.timeline !== prev.timeline) usePlaybackStore.getState().seek(0);
});

/** Convenience selector: the currently active event (or undefined for an empty timeline). */
export function useCurrentEvent() {
  const index = usePlaybackStore((s) => s.eventIndex);
  return useAppStore((s) => s.timeline.events[index]);
}
