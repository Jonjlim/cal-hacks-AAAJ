import { Vector3 } from 'three';
import { GRAPH } from '../simulation/graphData';

/**
 * High-frequency mutable state shared between frame loops (player, camera,
 * effects). Zustand holds the low-frequency state the UI renders from.
 */
export const runtime = {
  player: {
    position: new Vector3(...GRAPH.spawn),
    velocity: new Vector3(),
    /** Facing angle around Y (character local +Z). */
    facing: Math.PI / 2,
    speed: 0,
    grounded: true,
    sprinting: false,
  },
  /** Pending teleport consumed by the PlayerController. */
  teleport: null as Vector3 | null,
  checkpoint: new Vector3(...GRAPH.spawn),
  /** Third-person orbit (camera sits behind the player at -X on spawn). */
  look: { yaw: -Math.PI / 2, pitch: 0.16, distance: 8 },
  overview: { yaw: 0.18, pitch: 0.92, distance: 1050 },
  focus: { yaw: 0.6, pitch: 0.3, distance: 80 },
  /** True when the last overview pointer gesture was a drag (suppresses click-select). */
  dragMoved: false,
};

/** Held movement keys, by KeyboardEvent.code. */
export const heldKeys = new Set<string>();
