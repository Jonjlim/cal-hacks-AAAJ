import { useAppStore, useCurrentEvent } from '@/state';

/** What is happening right now, in one line, plus prefill/decode context. */
export function Caption() {
  const event = useCurrentEvent();
  const trace = useAppStore((s) => s.trace);
  if (!event) return null;
  const step = trace.steps[event.step];
  if (!step) return null;

  const phase =
    step.phase === 'prefill'
      ? `PREFILL · ${step.queryPositions.length} prompt tokens in parallel`
      : `DECODE ${step.index} · 1 new token · KV cache ${step.kvCacheBefore} → ${step.contextLength}`;

  return (
    <div className="caption" aria-live="polite">
      <div className={`caption__phase caption__phase--${step.phase}`}>{phase}</div>
      <div className="caption__label">{event.label}</div>
    </div>
  );
}
