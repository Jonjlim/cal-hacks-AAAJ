import { QuadraticBezierCurve3, Vector3 } from 'three';
import { PALETTE } from '../config/palette';
import type {
  NetworkEdge,
  NetworkGraph,
  NetworkNode,
  RegionId,
  RegionInfo,
  StructureVariant,
} from '../types/network';
import { hash01, hashString } from './noise';

/**
 * The single source of truth for the network. Both the walkable world and the
 * overview map render from this graph — there is no separate "map" dataset.
 *
 * Layout: layers march along +X (input -> output). Each layer is a column of
 * nodes spread along Z; the centre node of every layer sits on the walkable
 * main path (z = 0) and owns a deck. Off-path nodes float higher.
 */

export const LAYER_SPACING = 150;
export const LAYER_Z_SPACING = 80;
const FIRST_LAYER_X = -525;

export const REGIONS: Record<RegionId, RegionInfo> = {
  input: {
    id: 'input',
    name: 'Input & Tokenization',
    color: PALETTE.cyan,
    description:
      'Raw text enters the machine and is split into tokens — the discrete units the model reads.',
  },
  embedding: {
    id: 'embedding',
    name: 'Embedding',
    color: '#4F86FF',
    description:
      'Each token id is mapped to a vector: a position in a high-dimensional meaning space.',
  },
  attention: {
    id: 'attention',
    name: 'Attention',
    color: PALETTE.violet,
    description:
      'Tokens exchange information. Each one weighs how much every earlier token matters to it.',
  },
  transformer: {
    id: 'transformer',
    name: 'Transformer Processing',
    color: '#7FE3FF',
    description:
      'Stacked blocks of attention and feed-forward computation refine every token representation.',
  },
  output: {
    id: 'output',
    name: 'Output',
    color: PALETTE.gold,
    description:
      'The final representation is projected onto the vocabulary to score possible next tokens.',
  },
};

interface LayerSpec {
  region: RegionId;
  variant: StructureVariant;
  /** Centre entry is the walkable path node. */
  names: string[];
  coreY: number;
}

const LAYERS: LayerSpec[] = [
  { region: 'input', variant: 'gate', names: ['Input Gate'], coreY: 40 },
  {
    region: 'input',
    variant: 'tokenizer',
    names: ['Subword Splitter', 'Tokenizer Hub', 'Vocabulary Index'],
    coreY: 42,
  },
  {
    region: 'embedding',
    variant: 'embedding',
    names: ['Positional Encoder', 'Semantic Basin', 'Embedding Lattice', 'Vector Forge', 'Context Weave'],
    coreY: 45,
  },
  {
    region: 'attention',
    variant: 'attention',
    names: ['Query Spire', 'Key Array', 'Attention Nexus', 'Value Reservoir', 'Head Mosaic'],
    coreY: 48,
  },
  {
    region: 'transformer',
    variant: 'transformer',
    names: ['Residual Stream I', 'Norm Chamber I', 'Transformer Block I', 'Feed-Forward Core I', 'Gate Array I'],
    coreY: 50,
  },
  {
    region: 'transformer',
    variant: 'transformer',
    names: ['Residual Stream II', 'Norm Chamber II', 'Transformer Block II', 'Feed-Forward Core II', 'Gate Array II'],
    coreY: 51,
  },
  {
    region: 'output',
    variant: 'output',
    names: ['Probability Field', 'Logit Projector', 'Softmax Sampler'],
    coreY: 50,
  },
  { region: 'output', variant: 'gate', names: ['Output Gate'], coreY: 52 },
];

const DESCRIPTIONS: Record<StructureVariant, string> = {
  gate: 'A portal where the signal crosses the boundary between the outside world and the network.',
  tokenizer: 'Splits incoming text into token fragments and looks up their ids in the vocabulary.',
  embedding: 'Converts token ids into geometric vectors — the lattice is a slice of meaning space.',
  attention: 'Computes how strongly each token should attend to the others, ring by ring, head by head.',
  transformer: 'A repeated processing block: attention output is mixed, normalised and transformed.',
  output: 'Projects the final hidden state onto vocabulary scores and converges the signal.',
};

const GATE_SIZE = 9;
const PATH_SIZE = 8;
/** Distance between core centre and deck top for path nodes. */
const DECK_DROP = 18;

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function buildGraph(): NetworkGraph {
  const nodes: NetworkNode[] = [];
  const layers: string[][] = [];
  const path: string[] = [];

  LAYERS.forEach((spec, l) => {
    const n = spec.names.length;
    const c = Math.floor(n / 2);
    const ids: string[] = [];
    spec.names.forEach((name, j) => {
      const offset = j - c;
      const id = slug(name);
      const h = hash01(hashString(id));
      const onPath = offset === 0;
      const isGate = spec.variant === 'gate';
      const size = onPath ? (isGate ? GATE_SIZE : PATH_SIZE) : 5.2 + h * 2.4;
      const x = FIRST_LAYER_X + l * LAYER_SPACING + (onPath ? 0 : (h - 0.5) * 22);
      const y = onPath ? spec.coreY : spec.coreY + 20 + Math.abs(offset) * 12 + h * 10;
      const z = offset * LAYER_Z_SPACING;
      const region = REGIONS[spec.region];
      const node: NetworkNode = {
        id,
        index: nodes.length,
        name,
        description: DESCRIPTIONS[spec.variant],
        region: spec.region,
        layer: l,
        position: [x, y, z],
        size,
        connections: [],
        incoming: [],
        activity: 0.15 + h * 0.2,
        visual: {
          variant: spec.variant,
          color: region.color,
          accent: spec.region === 'output' ? PALETTE.white : PALETTE.cyan,
          coreScale: isGate ? 0.5 : 1,
        },
      };
      if (onPath) {
        // Gates are arches standing on the deck: the arch tube (radius 2*size) is
        // sunk just below the walking surface so the player passes through cleanly.
        const drop = isGate ? size * 2 - 1.5 : DECK_DROP;
        const radius = isGate ? 28 : 22;
        const top = y - drop;
        node.deck = { radius, top };
        node.interaction = {
          kind: l === 0 ? 'prompt' : 'info',
          label: l === 0 ? 'Inject a prompt' : `Interface with ${name}`,
          terminal: [x + 4, top, z + radius * 0.58],
        };
        path.push(id);
      }
      nodes.push(node);
      ids.push(id);
    });
    layers.push(ids);
  });

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const pathSet = new Set(path);
  const edges: NetworkEdge[] = [];
  const edgeByPair = new Map<string, NetworkEdge>();
  const outgoing = new Map<string, NetworkEdge[]>();

  // Adjacent layers are fully connected — the classic feed-forward diagram.
  for (let l = 0; l < layers.length - 1; l++) {
    for (const a of layers[l]) {
      for (const b of layers[l + 1]) {
        const src = nodeById.get(a)!;
        const dst = nodeById.get(b)!;
        const edge: NetworkEdge = {
          index: edges.length,
          source: a,
          target: b,
          sourceIndex: src.index,
          targetIndex: dst.index,
          primary: pathSet.has(a) && pathSet.has(b),
          weight: 0.35 + hash01(hashString(a + b)) * 0.65,
        };
        edges.push(edge);
        edgeByPair.set(`${a}->${b}`, edge);
        src.connections.push(b);
        dst.incoming.push(a);
        if (!outgoing.has(a)) outgoing.set(a, []);
        outgoing.get(a)!.push(edge);
      }
    }
  }

  const xs = nodes.map((n) => n.position[0]);
  const ys = nodes.map((n) => n.position[1]);
  const center: [number, number, number] = [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2 - 10,
    0,
  ];
  const gate = nodeById.get(path[0])!;
  // Echo starts just through the Input Gate, facing down the first highway.
  const spawn: [number, number, number] = [gate.position[0] + 12, gate.deck!.top + 1.2, 0];

  return {
    nodes,
    edges,
    regions: REGIONS,
    layers,
    path,
    nodeById,
    edgeByPair,
    outgoing,
    center,
    spawn,
  };
}

export const GRAPH: NetworkGraph = buildGraph();

/** Edge curves are shared by the renderer, ambient particles and the prompt signal. */
export const EDGE_CURVES: QuadraticBezierCurve3[] = GRAPH.edges.map((e) => {
  const a = new Vector3(...GRAPH.nodes[e.sourceIndex].position);
  const b = new Vector3(...GRAPH.nodes[e.targetIndex].position);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const len = a.distanceTo(b);
  // Gentle arcs: the references read as near-straight light-lines between nodes.
  mid.y += e.primary ? 8 + len * 0.05 : 3 + len * 0.05;
  return new QuadraticBezierCurve3(a, mid, b);
});

export function nodeVec(id: string, target = new Vector3()): Vector3 {
  const n = GRAPH.nodeById.get(id)!;
  return target.set(n.position[0], n.position[1], n.position[2]);
}

/** Nearest path node to a world position (by X — the path runs along X). */
export function nearestPathNode(x: number): NetworkNode {
  let best = GRAPH.nodeById.get(GRAPH.path[0])!;
  let bestD = Infinity;
  for (const id of GRAPH.path) {
    const n = GRAPH.nodeById.get(id)!;
    const d = Math.abs(n.position[0] - x);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}
