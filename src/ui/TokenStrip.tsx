import { showToken } from '@/core/format';
import { emittedTokens, promptTokenized } from '@/sim';
import { useAppStore, useCurrentEvent } from '@/state';

/** The sequence so far as token chips: prompt tokens, then generated tokens as they appear. */
export function TokenStrip() {
  const event = useCurrentEvent();
  const trace = useAppStore((s) => s.trace);
  if (!event) return null;

  const prompt = promptTokenized(event) ? trace.tokens.slice(0, trace.promptLength) : [];
  const generated = emittedTokens(trace, event);
  const active = new Set(event.positions);

  return (
    <div className="tokens" aria-label="Token sequence">
      {prompt.length === 0 && <span className="tokens__raw">“{trace.prompt}”</span>}
      {[...prompt, ...generated].map((t) => (
        <span
          key={t.position}
          className={`token token--${t.source} ${active.has(t.position) ? 'is-active' : ''} ${t.special ? 'token--special' : ''}`}
          title={`position ${t.position} · id ${t.id}`}
        >
          {showToken(t.text)}
        </span>
      ))}
    </div>
  );
}
