import type { SimEvent, Timeline } from '@/core/types';

/** Index of the event active at time t (last event with start <= t), clamped to the timeline. */
export function eventIndexAt(timeline: Timeline, t: number): number {
  const { events } = timeline;
  if (events.length === 0) return -1;
  let lo = 0;
  let hi = events.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (events[mid]!.start <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** 0..1 progress of an event at time t. */
export function eventProgress(event: SimEvent, t: number): number {
  if (event.duration <= 0) return 1;
  return Math.min(1, Math.max(0, (t - event.start) / event.duration));
}

/** Start time of the event after the one active at t (or the end of the timeline). */
export function nextBoundary(timeline: Timeline, t: number): number {
  const next = timeline.events[eventIndexAt(timeline, t) + 1];
  return next ? next.start : timeline.duration;
}

/**
 * Start of the current event, or of the previous one if we are already within
 * a small epsilon of the current start (so repeated presses keep moving back).
 */
export function prevBoundary(timeline: Timeline, t: number, epsilon = 0.25): number {
  const i = eventIndexAt(timeline, t);
  const current = timeline.events[i];
  if (!current) return 0;
  if (t - current.start > epsilon) return current.start;
  return timeline.events[i - 1]?.start ?? 0;
}

export function clampTime(timeline: Timeline, t: number): number {
  return Math.min(timeline.duration, Math.max(0, t));
}

/** Smooth in-out easing used by all scene interpolations. */
export function easeInOut(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
