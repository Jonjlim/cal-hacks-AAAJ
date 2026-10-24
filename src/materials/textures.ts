import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';

/**
 * Procedural canvas textures (no image assets). Generated lazily, once.
 */

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function finish(c: HTMLCanvasElement, repeat = false): CanvasTexture {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

let bridgeColor: CanvasTexture | null = null;
let bridgeEmissive: CanvasTexture | null = null;

/** Walkway plating: large grey tiles with dark seams (reference: green bridge). */
export function bridgeColorTexture(): Texture {
  if (bridgeColor) return bridgeColor;
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#7d8598';
  g.fillRect(0, 0, 512, 512);
  // subtle grime noise
  for (let i = 0; i < 2600; i++) {
    const v = 110 + Math.random() * 40;
    g.fillStyle = `rgba(${v},${v + 4},${v + 14},0.18)`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 5, 2 + Math.random() * 5);
  }
  g.strokeStyle = '#2a2f3c';
  g.lineWidth = 7;
  // two tiles across, one tile along per texture repeat
  g.strokeRect(14, 10, 236, 492);
  g.strokeRect(262, 10, 236, 492);
  g.lineWidth = 3;
  g.strokeStyle = '#4a5163';
  g.beginPath();
  g.moveTo(14, 256);
  g.lineTo(498, 256);
  g.stroke();
  bridgeColor = finish(c, true);
  return bridgeColor;
}

/** Emissive overlay: thin edge strips and flowing chevrons. */
export function bridgeEmissiveTexture(): Texture {
  if (bridgeEmissive) return bridgeEmissive;
  const [c, g] = canvas(256, 512);
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 512);
  g.fillStyle = '#9fe9ff';
  g.fillRect(2, 0, 5, 512);
  g.fillRect(249, 0, 5, 512);
  g.globalAlpha = 0.55;
  g.strokeStyle = '#43cdff';
  g.lineWidth = 6;
  for (let i = 0; i < 2; i++) {
    const y = 120 + i * 256;
    g.beginPath();
    g.moveTo(104, y + 22);
    g.lineTo(128, y);
    g.lineTo(152, y + 22);
    g.stroke();
  }
  bridgeEmissive = finish(c, true);
  return bridgeEmissive;
}

let deckTop: CanvasTexture | null = null;
/** Circular deck top: concentric rings, spokes and panel seams. */
export function deckTopTexture(): Texture {
  if (deckTop) return deckTop;
  const S = 1024;
  const [c, g] = canvas(S, S);
  const cx = S / 2;
  g.fillStyle = '#6f778b';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 5000; i++) {
    const v = 100 + Math.random() * 40;
    g.fillStyle = `rgba(${v},${v + 4},${v + 14},0.16)`;
    g.fillRect(Math.random() * S, Math.random() * S, 3 + Math.random() * 6, 3 + Math.random() * 6);
  }
  g.strokeStyle = '#272c39';
  for (const [r, w] of [[500, 14], [430, 8], [300, 6], [180, 10], [90, 6]] as const) {
    g.lineWidth = w;
    g.beginPath();
    g.arc(cx, cx, r, 0, Math.PI * 2);
    g.stroke();
  }
  g.lineWidth = 6;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * 180, cx + Math.sin(a) * 180);
    g.lineTo(cx + Math.cos(a) * 500, cx + Math.sin(a) * 500);
    g.stroke();
  }
  deckTop = finish(c);
  return deckTop;
}

let deckGlow: CanvasTexture | null = null;
/** Emissive rings for the deck top. */
export function deckGlowTexture(): Texture {
  if (deckGlow) return deckGlow;
  const S = 1024;
  const [c, g] = canvas(S, S);
  const cx = S / 2;
  g.fillStyle = '#000';
  g.fillRect(0, 0, S, S);
  g.strokeStyle = '#bff3ff';
  g.lineWidth = 6;
  g.beginPath();
  g.arc(cx, cx, 492, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = '#43cdff';
  g.lineWidth = 4;
  g.setLineDash([60, 30]);
  g.beginPath();
  g.arc(cx, cx, 300, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  g.lineWidth = 10;
  g.beginPath();
  g.arc(cx, cx, 100, 0, Math.PI * 2);
  g.stroke();
  deckGlow = finish(c);
  return deckGlow;
}

const screenCache = new Map<string, CanvasTexture>();
/** Console screen with the node name, mono readout style (reference: network-city labels). */
export function consoleScreenTexture(title: string, subtitle: string, hex: string): Texture {
  const key = title + subtitle;
  const hit = screenCache.get(key);
  if (hit) return hit;
  const [c, g] = canvas(512, 288);
  g.fillStyle = '#020814';
  g.fillRect(0, 0, 512, 288);
  g.strokeStyle = hex;
  g.lineWidth = 4;
  g.strokeRect(10, 10, 492, 268);
  g.fillStyle = hex;
  g.font = '600 22px "JetBrains Mono", monospace';
  g.fillText(subtitle.toUpperCase(), 30, 52);
  g.fillStyle = '#eaf8ff';
  g.font = '700 40px "Rajdhani", sans-serif';
  g.fillText(title.toUpperCase(), 30, 104);
  g.globalAlpha = 0.6;
  g.fillStyle = hex;
  for (let i = 0; i < 9; i++) {
    const w = 60 + ((i * 97) % 300);
    g.fillRect(30, 136 + i * 14, w, 6);
  }
  g.globalAlpha = 1;
  g.font = '500 20px "JetBrains Mono", monospace';
  g.fillText('[ E ] INTERFACE', 300, 258);
  const t = finish(c);
  screenCache.set(key, t);
  return t;
}
