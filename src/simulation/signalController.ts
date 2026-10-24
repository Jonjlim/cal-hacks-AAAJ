import { Vector3 } from 'three';
import { EDGE_CURVES, GRAPH, nodeVec } from './graphData';
import { bumpNode, energiseEdge } from './networkActivity';
import type { SignalTrace, StageId } from './promptSimulation';
import { PALETTE } from '../config/palette';

/**
 * Deterministic prompt-signal timeline. Given a trace and an elapsed time it
 * produces exactly one state, so a single prompt can always be followed.
 */

interface Hop {
  from: number; // layer index, -1 = sky
  to: number;
  start: number;
  end: number;
}

interface StageWindow {
  id: StageId;
  start: number;
  end: number;
}

const STAGE_WINDOWS: StageWindow[] = [
  { id: 'input', start: 0, end: 2.6 },
  { id: 'tokenization', start: 2.6, end: 6.2 },
  { id: 'embedding', start: 6.2, end: 9.6 },
  { id: 'attention', start: 9.6, end: 14.6 },
  { id: 'transformer', start: 14.6, end: 19.8 },
  { id: 'output', start: 19.8, end: 24.4 },
];

const HOPS: Hop[] = [
  { from: 0, to: 1, start: 3.2, end: 6.0 },
  { from: 1, to: 2, start: 6.2, end: 9.2 },
  { from: 2, to: 3, start: 9.6, end: 11.6 },
  { from: 3, to: 4, start: 14.6, end: 17.0 },
  { from: 4, to: 5, start: 17.2, end: 19.6 },
  { from: 5, to: 6, start: 19.8, end: 21.6 },
  { from: 6, to: 7, start: 21.8, end: 23.4 },
];

export const TIMELINE_END = 26.5;

export interface FragmentState {
  position: Vector3;
  visible: boolean;
  /** 0 = sphere, 1 = geometric embedding shape. */
  morph: number;
  scale: number;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

const skyOrigin = (() => {
  const g = nodeVec(GRAPH.path[0]);
  return g.add(new Vector3(110, 230, -90));
})();

export class SignalController {
  trace: SignalTrace | null = null;
  time = 0;
  running = false;
  stage: StageId | null = null;
  fragments: FragmentState[] = [];
  orb = { position: new Vector3(), visible: false, scale: 1 };
  /** Intensity of attention links between fragments, 0..1. */
  attention = 0;
  /** Output beam growth 0..1 and fade. */
  outputBeam = 0;
  /** Incoming sky stream 0..1. */
  incoming = 0;

  private arrived = new Set<string>();
  private tmp = new Vector3();
  private tmpB = new Vector3();
  private onStage: (s: StageId | null, done: boolean) => void = () => {};

  setStageListener(fn: (s: StageId | null, done: boolean) => void) {
    this.onStage = fn;
  }

  start(trace: SignalTrace) {
    this.trace = trace;
    this.time = 0;
    this.running = true;
    this.stage = null;
    this.arrived.clear();
    this.fragments = trace.tokens.map(() => ({
      position: new Vector3(),
      visible: false,
      morph: 0,
      scale: 1,
    }));
  }

  stop() {
    this.running = false;
    this.trace = null;
    this.fragments = [];
    this.orb.visible = false;
    this.attention = 0;
    this.outputBeam = 0;
    this.incoming = 0;
    this.stage = null;
  }

  /** Orbit offset of token k around the node it is visiting at a layer. */
  private orbitOffset(k: number, layer: number, out: Vector3) {
    if (!this.trace || layer < 0) return out.set(0, 0, 0);
    if (layer === 0 || layer === GRAPH.layers.length - 1) return out.set(0, 0, 0);
    const node = GRAPH.nodeById.get(this.trace.routes[k][layer])!;
    const a = k * 2.399 + this.time * 0.7 + layer;
    const r = node.size * 1.7;
    return out.set(Math.cos(a) * r, Math.sin(a * 1.3) * r * 0.45, Math.sin(a) * r);
  }

  private layerNodePos(k: number, layer: number, out: Vector3) {
    if (layer < 0) return out.copy(skyOrigin);
    return nodeVec(this.trace!.routes[k][layer], out);
  }

  update(dt: number) {
    if (!this.running || !this.trace) return;
    this.time += dt;
    const t = this.time;
    const trace = this.trace;
    const n = trace.tokens.length;

    const stage = STAGE_WINDOWS.find((w) => t >= w.start && t < w.end)?.id ?? (t < TIMELINE_END ? 'output' : null);
    if (stage !== this.stage) {
      this.stage = stage;
      this.onStage(stage, false);
    }

    const gate = GRAPH.nodeById.get(GRAPH.path[0])!;
    const outGate = GRAPH.nodeById.get(GRAPH.path[GRAPH.path.length - 1])!;

    // --- Input: single orb streams down from the sky into the input gate.
    if (t < 2.6) {
      const e = ease(clamp01(t / 2.4));
      this.incoming = clamp01(t / 0.8);
      this.orb.visible = true;
      this.orb.scale = 2.4;
      this.orb.position.copy(skyOrigin).lerp(nodeVec(gate.id, this.tmp), e);
      this.orb.position.y += Math.sin(e * Math.PI) * 30;
    } else {
      this.incoming = Math.max(0, this.incoming - dt * 1.5);
    }
    this.once('gate-arrive', t >= 2.4, () => bumpNode(gate.index, 1.2, { color: PALETTE.gold }));

    // --- Fragments
    const sp = n > 1 ? Math.min(0.35, 0.05 * (n - 1)) : 0;
    for (let k = 0; k < n; k++) {
      const f = this.fragments[k];
      f.visible = t >= 2.6 && t < 23.6;
      f.morph = clamp01((t - 7.0) / 1.6);
      f.scale = 1;
      if (!f.visible) continue;

      // Find active hop or the layer we are holding at.
      let placed = false;
      for (const hop of HOPS) {
        if (t < hop.start) {
          // Hold at the hop's source layer.
          this.holdAt(k, hop.from, f.position);
          if (hop.from === 0) {
            // Tokenization burst: offsets grow out of the gate.
            const g = clamp01((t - 2.6) / 0.6);
            const a = (k / Math.max(1, n)) * Math.PI * 2 + t * 0.6;
            f.position
              .copy(nodeVec(gate.id, this.tmp))
              .add(this.tmpB.set(Math.cos(a) * 6 * g, Math.sin(a) * 6 * g, Math.sin(a * 2) * 3 * g));
          }
          placed = true;
          break;
        }
        if (t <= hop.end) {
          const local = (t - hop.start) / (hop.end - hop.start);
          const kt = n > 1 ? clamp01((local - (k / (n - 1)) * sp) / (1 - sp)) : clamp01(local);
          const e = ease(kt);
          const src = trace.routes[k][hop.from];
          const dst = trace.routes[k][hop.to];
          const edge = GRAPH.edgeByPair.get(`${src}->${dst}`);
          if (edge) {
            EDGE_CURVES[edge.index].getPoint(e, f.position);
            if (kt > 0 && kt < 1) energiseEdge(edge.index, 1);
          } else {
            this.layerNodePos(k, hop.from, f.position).lerp(this.layerNodePos(k, hop.to, this.tmp), e);
          }
          this.orbitOffset(k, hop.from, this.tmp).multiplyScalar(1 - e);
          this.orbitOffset(k, hop.to, this.tmpB).multiplyScalar(e);
          f.position.add(this.tmp).add(this.tmpB);
          if (kt >= 1) this.arrive(k, hop.to);
          placed = true;
          break;
        }
        // hop finished: make sure arrival registered
        this.arrive(k, hop.to);
      }
      if (!placed) this.holdAt(k, GRAPH.layers.length - 1, f.position);
    }

    // --- Attention links pulse while fragments sit in the attention layer.
    this.attention = t > 11.4 && t < 14.6 ? Math.sin(((t - 11.4) / 3.2) * Math.PI) : 0;

    // --- Output: merged orb + beam.
    if (t >= 23.4) {
      this.orb.visible = true;
      const g = clamp01((t - 23.4) / 0.6);
      this.orb.scale = 1.5 + g * 2.5 + Math.sin(t * 6) * 0.2;
      nodeVec(outGate.id, this.orb.position);
      this.outputBeam = t < 25.5 ? clamp01((t - 23.6) / 1.2) : Math.max(0, 1 - (t - 25.5));
      this.once('out-arrive', true, () => bumpNode(outGate.index, 1.6, { color: PALETTE.gold }));
    } else if (t >= 2.6) {
      this.orb.visible = false;
    }

    if (t >= TIMELINE_END) {
      this.running = false;
      this.orb.visible = false;
      this.outputBeam = 0;
      this.fragments.forEach((f) => (f.visible = false));
      this.stage = null;
      this.onStage(null, true);
    }
  }

  private holdAt(k: number, layer: number, out: Vector3) {
    this.layerNodePos(k, layer, out).add(this.orbitOffset(k, layer, this.tmpB));
  }

  private arrive(k: number, layer: number) {
    const key = `${k}:${layer}`;
    if (this.arrived.has(key) || !this.trace) return;
    this.arrived.add(key);
    const node = GRAPH.nodeById.get(this.trace.routes[k][layer])!;
    bumpNode(node.index, 0.7, { color: layer >= 6 ? PALETTE.gold : PALETTE.white });
  }

  private once(key: string, cond: boolean, fn: () => void) {
    if (cond && !this.arrived.has(key)) {
      this.arrived.add(key);
      fn();
    }
  }
}

/** The one controller instance the scene renders from. */
export const signalController = new SignalController();
