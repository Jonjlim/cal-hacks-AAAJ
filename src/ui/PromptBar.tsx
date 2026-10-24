import { useState, type FormEvent } from 'react';
import { PRESET_PROMPTS } from '@/core/config';
import { useAppStore, usePlaybackStore } from '@/state';

export function PromptBar() {
  const prompt = useAppStore((s) => s.prompt);
  const error = useAppStore((s) => s.error);
  const [draft, setDraft] = useState(prompt);

  const submit = (text: string) => {
    if (useAppStore.getState().run(text)) {
      useAppStore.getState().setMode('guided');
      usePlaybackStore.getState().play();
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(draft);
  };

  return (
    <form className="prompt" onSubmit={onSubmit}>
      <label className="prompt__label" htmlFor="prompt-input">
        Prompt
      </label>
      <input
        id="prompt-input"
        className="prompt__input"
        value={draft}
        maxLength={80}
        spellCheck={false}
        onChange={(e) => setDraft(e.target.value)}
        list="prompt-presets"
      />
      <datalist id="prompt-presets">
        {PRESET_PROMPTS.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <button className="btn btn--primary" type="submit">
        Run ▶
      </button>
      {error && (
        <span className="prompt__error" role="alert">
          {error}
        </span>
      )}
    </form>
  );
}
