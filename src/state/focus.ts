import { useMemo } from 'react';
import type { FocusTarget, SimEvent } from '@/core/types';
import { useAppStore } from './appStore';
import { useCurrentEvent } from './playbackStore';

/** Guided mode: what the camera/inspector should focus on while an event plays. */
export function focusForEvent(event: SimEvent): FocusTarget {
  // Later decode steps are fast-forwarded: pull back so the whole loop is visible.
  if (event.step >= 2) return { kind: 'overview' };
  if (event.layer !== undefined) {
    if (event.layer > 0) return { kind: 'station', station: 'transformer' };
    return event.step === 0 && event.op === 'attention'
      ? { kind: 'layer', layer: 0, op: 'attention' }
      : { kind: 'layer', layer: 0 };
  }
  return { kind: 'station', station: event.station };
}

/** The focus actually in effect: guided mode follows the simulation, explore mode the user. */
export function useResolvedFocus(): FocusTarget {
  const mode = useAppStore((s) => s.mode);
  const focus = useAppStore((s) => s.focus);
  const event = useCurrentEvent();
  return useMemo(
    () => (mode === 'guided' && event ? focusForEvent(event) : focus),
    [mode, focus, event],
  );
}
