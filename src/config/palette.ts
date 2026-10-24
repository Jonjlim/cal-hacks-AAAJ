/** Inside the Machine colour system. Every material and UI token derives from these. */
export const PALETTE = {
  navy: '#09152D',
  deepBlue: '#10274D',
  cyan: '#43CDFF',
  blue: '#255BCE',
  violet: '#8A70E9',
  gold: '#F0C477',
  white: '#EAF8FF',
  magenta: '#EA6C91',
} as const;

/** Atmosphere colours used by sky, fog and terrain shaders. */
export const ATMOSPHERE = {
  zenith: '#060d22',
  horizon: '#3b2a78',
  horizonGlow: '#8A70E9',
  fog: '#140f33',
  fogDensity: 0.00055,
} as const;
