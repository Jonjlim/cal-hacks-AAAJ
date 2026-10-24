import { useEffect, useRef, useState } from 'react';
import { requestLock, runPrompt } from '../app/input';
import { STAGES } from '../simulation/promptSimulation';
import { settledMode, useGameStore } from '../store/useGameStore';

export function PromptPanel() {
  const open = useGameStore((s) => s.promptOpen);
  const setOpen = useGameStore((s) => s.setPromptOpen);
  const status = useGameStore((s) => s.prompt.status);
  const [text, setText] = useState('The cat sat on the mat.');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 30);
  }, [open]);

  if (!open) return null;
  const submit = () => {
    if (!text.trim()) return;
    runPrompt(text.trim());
    setOpen(false);
    if (settledMode() === 'EXPLORATION') requestLock();
  };
  return (
    <div className="panel prompt-panel">
      <header>
        <span>PROMPT INJECTION PORT</span>
        <span className="badge">SIMULATED</span>
      </header>
      <p>
        Type a sentence and watch it travel through the network as a luminous signal. This prototype runs a
        deterministic <b>visual simulation</b> — no language model is connected yet.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input ref={input} value={text} maxLength={120} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="primary">
          {status === 'running' ? 'Restart signal' : 'Transmit'}
        </button>
      </form>
      <footer>
        <button className="ghost" onClick={() => setOpen(false)}>
          Close <kbd>Esc</kbd>
        </button>
        <span>Tip: press <kbd>Tab</kbd> after transmitting to follow the signal from the overview.</span>
      </footer>
    </div>
  );
}

export function StageTracker() {
  const prompt = useGameStore((s) => s.prompt);
  if (prompt.status === 'idle') return null;
  const active = STAGES.findIndex((s) => s.id === prompt.stage);
  const caption = active >= 0 ? STAGES[active].caption : prompt.summary;
  return (
    <div className="panel stage-tracker">
      <div className="stages">
        {STAGES.map((s, i) => (
          <span
            key={s.id}
            className={i === active ? 'on' : prompt.status === 'complete' || (active >= 0 && i < active) ? 'done' : ''}
          >
            {s.label}
          </span>
        ))}
      </div>
      <div className="caption">
        <span className="badge">SIMULATED</span> {caption}
      </div>
      <div className="tokens">
        {prompt.tokens.map((t, i) => (
          <code key={i}>{t}</code>
        ))}
      </div>
    </div>
  );
}
