import { GRAPH } from './graphData';

/**
 * Per-frame activity buffers. Kept outside React/Zustand so that dozens of
 * writes per frame never trigger re-renders; renderers read them in useFrame.
 */
export const nodeActivity = new Float32Array(GRAPH.nodes.length);
export const edgeActivity = new Float32Array(GRAPH.edges.length);

export interface PulseEvent {
  node: number;
  strength: number;
  color: string;
}

/** Shock-ring requests consumed by <NodePulse>. */
export const pulseQueue: PulseEvent[] = [];

export function bumpNode(index: number, amount: number, pulse?: { color: string }) {
  nodeActivity[index] = Math.min(2, nodeActivity[index] + amount);
  if (pulse) pulseQueue.push({ node: index, strength: Math.min(1, amount), color: pulse.color });
}

export function energiseEdge(index: number, amount = 1) {
  edgeActivity[index] = Math.max(edgeActivity[index], amount);
}

export function decayActivity(dt: number) {
  const nk = Math.exp(-dt * 1.4);
  const ek = Math.exp(-dt * 2.2);
  for (let i = 0; i < nodeActivity.length; i++) nodeActivity[i] *= nk;
  for (let i = 0; i < edgeActivity.length; i++) edgeActivity[i] *= ek;
}
