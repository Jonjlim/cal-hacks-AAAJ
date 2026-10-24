import { useEffect, useMemo, useState } from 'react';
import { formatProb, showToken } from '@/core/format';
import { samplingDistribution } from '@/sim';
import { useAppStore, useCurrentEvent, usePlaybackStore } from '@/state';

const SHOWN = 10;

/**
 * Interactive experiment: change temperature / top-k / top-p and watch the distribution
 * (here and on the 3D pillars) reshape. "Re-run" regenerates the whole response.
 */
export function SamplingLab() {
  const event = useCurrentEvent();
  const trace = useAppStore((s) => s.trace);
  const sampling = useAppStore((s) => s.sampling);
  const [draft, setDraft] = useState({
    temperature: sampling.temperature,
    topK: sampling.topK,
    topP: sampling.topP,
  });

  useEffect(() => {
    setDraft({ temperature: sampling.temperature, topK: sampling.topK, topP: sampling.topP });
  }, [sampling]);

  useEffect(() => {
    const changed =
      draft.temperature !== sampling.temperature ||
      draft.topK !== sampling.topK ||
      draft.topP !== sampling.topP;
    useAppStore.getState().setSamplingDraft(changed ? draft : null);
  }, [draft, sampling]);

  useEffect(() => () => useAppStore.getState().setSamplingDraft(null), []);

  const step = trace.steps[event?.step ?? 0];
  const candidates = useMemo(() => step?.logits.candidates ?? [], [step]);
  const dist = useMemo(
    () =>
      samplingDistribution(
        candidates.map((c) => c.logit),
        draft,
      ),
    [candidates, draft],
  );

  const rerun = (patch: Partial<typeof sampling> = {}) => {
    if (useAppStore.getState().run(undefined, { ...draft, ...patch })) {
      usePlaybackStore.getState().play();
    }
  };

  return (
    <div className="lab">
      <label className="lab__slider">
        <span>Temperature</span>
        <input
          type="range"
          min={0}
          max={2}
          step={0.05}
          value={draft.temperature}
          onChange={(e) => setDraft({ ...draft, temperature: Number(e.target.value) })}
        />
        <output>{draft.temperature === 0 ? 'greedy' : draft.temperature.toFixed(2)}</output>
      </label>
      <label className="lab__slider">
        <span>Top-k</span>
        <input
          type="range"
          min={0}
          max={candidates.length}
          step={1}
          value={draft.topK}
          onChange={(e) => setDraft({ ...draft, topK: Number(e.target.value) })}
        />
        <output>{draft.topK === 0 ? 'off' : draft.topK}</output>
      </label>
      <label className="lab__slider">
        <span>Top-p</span>
        <input
          type="range"
          min={0.05}
          max={1}
          step={0.01}
          value={draft.topP}
          onChange={(e) => setDraft({ ...draft, topP: Number(e.target.value) })}
        />
        <output>{draft.topP >= 1 ? 'off' : draft.topP.toFixed(2)}</output>
      </label>

      <ul className="lab__dist">
        {candidates.slice(0, SHOWN).map((c, i) => (
          <li key={c.id} className={dist.kept[i] ? '' : 'is-cut'}>
            <span className="lab__tok">
              {showToken(c.text)}
              {c.id === step?.sampled.id && <em> ← picked</em>}
            </span>
            <span className="lab__bar">
              <span className="lab__bar-raw" style={{ width: `${dist.rawProbs[i]! * 100}%` }} />
              <span className="lab__bar-final" style={{ width: `${dist.probs[i]! * 100}%` }} />
            </span>
            <span className="lab__val">{formatProb(dist.probs[i]!)}</span>
          </li>
        ))}
      </ul>
      <p className="muted small">
        Outline = plain softmax · fill = distribution sampled from. Preview uses this step’s{' '}
        {candidates.length} highest-scoring candidates (illustrative n-gram scores).
      </p>
      <div className="lab__actions">
        <button className="btn btn--primary" onClick={() => rerun()}>
          Re-run with these settings
        </button>
        <button
          className="btn"
          onClick={() => rerun({ seed: sampling.seed + 1 })}
          title="Same settings, different random draw"
        >
          New seed ({sampling.seed + 1})
        </button>
      </div>
    </div>
  );
}
