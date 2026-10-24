/** Display a token so leading spaces are visible: " machine" => "␣machine". */
export function showToken(text: string): string {
  if (text === '<|endoftext|>') return '⟨end⟩';
  return text.replace(/ /g, '␣').replace(/\n/g, '⏎');
}

/**
 * Same idea using only Latin-1 glyphs, for 3D text: the bundled font subset lacks "␣",
 * and missing glyphs make troika fetch fallback fonts from a CDN.
 */
export function showToken3D(text: string): string {
  if (text === '<|endoftext|>') return '<end>';
  return text.replace(/ /g, '·').replace(/\n/g, '\\n');
}

export function formatProb(p: number): string {
  if (p === 0) return '0%';
  if (p < 0.001) return '<0.1%';
  return `${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%`;
}

export function formatNumber(x: number, digits = 2): string {
  return x.toFixed(digits).replace(/^-0\.0+$/, '0.00');
}
