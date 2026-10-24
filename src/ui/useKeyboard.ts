import { useEffect } from 'react';
import { useAppStore, usePlaybackStore } from '@/state';

/** Global shortcuts. Ignored while typing in form fields. */
export function useKeyboard(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select')) return;
      const pb = usePlaybackStore.getState();
      switch (e.key) {
        case ' ':
          e.preventDefault();
          pb.toggle();
          break;
        case 'ArrowRight':
          pb.stepForward();
          break;
        case 'ArrowLeft':
          pb.stepBack();
          break;
        case 'Home':
          pb.reset();
          break;
        case 'g':
          useAppStore.getState().setMode('guided');
          break;
        case 'o':
        case 'Escape':
          useAppStore.getState().focusOn({ kind: 'overview' });
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
