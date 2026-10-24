import { useFrame } from '@react-three/fiber';
import type { InferenceTrace, SimEvent, Timeline } from '@/core/types';
import { eventIndexAt, eventProgress } from '@/sim';
import { clock, useAppStore } from '@/state';

export interface SimFrame {
  t: number;
  index: number;
  event: SimEvent;
  /** 0..1 within the active event. */
  progress: number;
  trace: InferenceTrace;
  timeline: Timeline;
  delta: number;
  elapsed: number;
}

/**
 * Per-frame access to simulation time without React renders. Use this for all
 * animation; read React state only for things that change per trace/event.
 */
export function useSimFrame(callback: (frame: SimFrame) => void): void {
  useFrame((state, delta) => {
    const { timeline, trace } = useAppStore.getState();
    const t = clock.time;
    const index = eventIndexAt(timeline, t);
    const event = timeline.events[index];
    if (!event) return;
    callback({
      t,
      index,
      event,
      progress: eventProgress(event, t),
      trace,
      timeline,
      delta,
      elapsed: state.clock.elapsedTime,
    });
  });
}

/** Exponential smoothing toward a target that is frame-rate independent. */
export function damp(current: number, target: number, lambda: number, delta: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * delta));
}
