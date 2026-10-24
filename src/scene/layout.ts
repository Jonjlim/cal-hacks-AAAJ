import type { BlockOp, FocusTarget, SimEvent, StationId } from '@/core/types';

/**
 * World layout. Data flows along +x. Each token position is a lane along z: the residual
 * stream. Only attention moves information *between* lanes. Owner: Graphics.
 */

export const LAYER_WIDTH = 6;
export const BLOCKS_START_X = -10;
export const LANE_SPACING = 0.6;
export const PACKET_Y = 0.6;
/** Peak height of the attention arches; attention arcs are drawn under it. */
export const ARCH_H = 3.4;

export const STATION_X: Record<StationId, number> = {
  input: -34,
  tokenizer: -26,
  embedding: -18,
  transformer: BLOCKS_START_X + LAYER_WIDTH * 2,
  lmHead: 20,
  sampler: 26,
  output: 33,
};

const OP_OFFSET: Record<BlockOp, number> = {
  norm1: 0.6,
  attention: 1.9,
  residual1: 3.1,
  norm2: 3.7,
  mlp: 4.6,
  residual2: 5.5,
};

export function layerX(layer: number): number {
  return BLOCKS_START_X + layer * LAYER_WIDTH;
}

export function opX(layer: number, op: BlockOp): number {
  return layerX(layer) + OP_OFFSET[op];
}

/** z coordinate for a token position, centred on the full sequence length. */
export function laneZ(position: number, totalPositions: number): number {
  return (position - (totalPositions - 1) / 2) * LANE_SPACING;
}

export function lanesHalfWidth(totalPositions: number): number {
  return (Math.max(totalPositions, 2) * LANE_SPACING) / 2 + 0.4;
}

/** x position where the data packets sit while `event` runs. */
export function eventAnchorX(event: SimEvent): number {
  if (event.layer !== undefined && event.op) return opX(event.layer, event.op);
  return STATION_X[event.station];
}

/** Height of the autoregressive loop arc (output -> embedding). */
export const LOOP_HEIGHT = 9;

/** Point on the autoregressive loop at parameter u in 0..1 (shared by the arc and packets). */
export function loopPoint(u: number): [number, number] {
  const x = STATION_X.output + (STATION_X.embedding - STATION_X.output) * u;
  return [x, PACKET_Y + LOOP_HEIGHT * Math.sin(Math.PI * u)];
}

export const RESIDUAL_START_X = STATION_X.embedding + 1.4;
export const RESIDUAL_END_X = STATION_X.lmHead - 1.8;

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
}

/**
 * Close-ups use a three-quarter view from upstream (-x): lanes spread across the screen
 * and attention arcs, which live in the y–z plane, are seen face-on.
 */
export function cameraPoseFor(focus: FocusTarget, nLayers: number): CameraPose {
  switch (focus.kind) {
    case 'overview': {
      const mid = (STATION_X.input + STATION_X.output) / 2;
      return { position: [mid - 6, 28, 46], target: [mid + 1, 1, 0] };
    }
    case 'station': {
      if (focus.station === 'transformer') {
        const cx = layerX(0) + (nLayers * LAYER_WIDTH) / 2;
        return { position: [cx - 14, 13, 17], target: [cx, 1, 0] };
      }
      const x = STATION_X[focus.station];
      return { position: [x - 6.5, 5.5, 8.5], target: [x + 1, 1.4, 0] };
    }
    case 'layer': {
      if (focus.op === 'attention') {
        const x = opX(focus.layer, 'attention');
        // Stays downstream of the embedding table so layer 1 is not occluded; the +z target
        // offset keeps the subject left of the inspector panel.
        return { position: [x - 7, 7.5, 10], target: [x, 4, 2.8] };
      }
      const x = focus.op ? opX(focus.layer, focus.op) : layerX(focus.layer) + LAYER_WIDTH / 2;
      return { position: [x - 7, 6.5, 8], target: [x + 0.5, 1.2, 0] };
    }
  }
}
