export type QualityLevel = 'low' | 'medium' | 'high';

export interface QualityPreset {
  dpr: [number, number];
  bloom: boolean;
  bloomIntensity: number;
  multisampling: number;
  shadows: boolean;
  /** Ambient signal particles flowing along graph edges. */
  signalParticles: number;
  /** Drifting dust around the camera. */
  dust: number;
  stars: number;
  terrainSegments: number;
  /** Beyond this camera distance small node details are hidden. */
  detailDistance: number;
  cityTowersPerCluster: number;
}

export const QUALITY: Record<QualityLevel, QualityPreset> = {
  low: {
    dpr: [1, 1],
    bloom: false,
    bloomIntensity: 0,
    multisampling: 0,
    shadows: false,
    signalParticles: 220,
    dust: 700,
    stars: 2500,
    terrainSegments: 150,
    detailDistance: 520,
    cityTowersPerCluster: 7,
  },
  medium: {
    dpr: [1, 1.5],
    bloom: true,
    bloomIntensity: 0.9,
    multisampling: 0,
    shadows: false,
    signalParticles: 480,
    dust: 1600,
    stars: 5000,
    terrainSegments: 240,
    detailDistance: 900,
    cityTowersPerCluster: 12,
  },
  high: {
    dpr: [1, 2],
    bloom: true,
    bloomIntensity: 1.05,
    multisampling: 4,
    shadows: true,
    signalParticles: 900,
    dust: 3200,
    stars: 9000,
    terrainSegments: 340,
    detailDistance: 1600,
    cityTowersPerCluster: 18,
  },
};
