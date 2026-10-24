import { useFrame } from '@react-three/fiber';
import { eventIndexAt } from '@/sim';
import { clock, useAppStore, usePlaybackStore } from '@/state';

/** The only writer of `clock.time` during playback. Renders nothing. */
export function PlaybackDriver() {
  useFrame((_, delta) => {
    const playback = usePlaybackStore.getState();
    const { timeline } = useAppStore.getState();
    if (playback.playing) {
      // Clamp delta so a backgrounded tab doesn't skip half the journey on return.
      clock.time = Math.min(timeline.duration, clock.time + Math.min(delta, 0.1) * playback.speed);
      if (clock.time >= timeline.duration) playback.pause();
    }
    playback.syncEventIndex(eventIndexAt(timeline, clock.time));
  });
  return null;
}
