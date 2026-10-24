import { useState } from 'react';
import { formatProb, showToken } from '@/core/format';
import { HEAD_COLORS } from '@/core/theme';
import { visibleAttention } from '@/sim';
import { useAppStore, useCurrentEvent } from '@/state';

/** Deep dive: pick a head and a query token, see exactly how its attention is distributed. */
export function AttentionInspector({ layer }: { layer: number }) {
  const event = useCurrentEvent();
  const trace = useAppStore((s) => s.trace);
  const head = useAppStore((s) => s.attentionHead);
  const setHead = useAppStore((s) => s.setAttentionHead);
  const [picked, setPicked] = useState<number | null>(null);

  const visible = event ? visibleAttention(trace, event, layer, head) : null;
  if (!visible || visible.rows.length === 0) {
    return (
      <p className="muted">
        This layer hasn’t run attention yet. Press play or step forward to reach it.
      </p>
    );
  }

  const n = visible.rows.length;
  const query = picked !== null && picked < n ? picked : n - 1;
  const row = visible.rows[query]!;
  const tokens = trace.tokens.slice(0, n);
  const color = HEAD_COLORS[head % HEAD_COLORS.length]!;

  return (
    <div className="attn">
      <div className="attn__heads" role="radiogroup" aria-label="Attention head">
        {Array.from({ length: trace.model.nHeads }, (_, h) => (
          <button
            key={h}
            role="radio"
            aria-checked={h === head}
            className={`btn btn--chip ${h === head ? 'is-active' : ''}`}
            style={{ borderColor: HEAD_COLORS[h % HEAD_COLORS.length] }}
            onClick={() => setHead(h)}
          >
            Head {h + 1}
          </button>
        ))}
      </div>
      <label className="attn__query">
        Query token
        <select value={query} onChange={(e) => setPicked(Number(e.target.value))}>
          {tokens.map((t) => (
            <option key={t.position} value={t.position}>
              {t.position}: {showToken(t.text)}
            </option>
          ))}
        </select>
      </label>
      <ul className="attn__rows">
        {tokens.map((t, j) => {
          const masked = j > query;
          const w = row[j] ?? 0;
          return (
            <li key={j} className={masked ? 'is-masked' : ''}>
              <span className="attn__tok">{showToken(t.text)}</span>
              <span className="attn__bar">
                {!masked && <span style={{ width: `${w * 100}%`, background: color }} />}
              </span>
              <span className="attn__val">{masked ? 'masked' : formatProb(w)}</span>
            </li>
          );
        })}
      </ul>
      <p className="muted small">
        Row sums to {row.reduce((a, b) => a + b, 0).toFixed(2)}. Future tokens are masked to exactly
        0 — “{showToken(tokens[query]!.text)}” cannot see what comes after it.
        {visible.currentRows.length === 1 &&
          ' This decode step added only the last row; earlier rows came from the KV cache.'}
      </p>
    </div>
  );
}
