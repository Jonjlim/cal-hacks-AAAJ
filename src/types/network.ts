export type RegionId = 'input' | 'embedding' | 'attention' | 'transformer' | 'output';

export type StructureVariant =
  | 'gate'
  | 'tokenizer'
  | 'embedding'
  | 'attention'
  | 'transformer'
  | 'output';

export type Vec3 = [number, number, number];

export interface NodeVisual {
  variant: StructureVariant;
  /** Primary emissive colour. */
  color: string;
  /** Secondary accent colour. */
  accent: string;
  /** Core sphere radius = size * coreScale. */
  coreScale: number;
}

/** Walkable deck under a node on the main signal path. */
export interface NodeDeck {
  radius: number;
  /** World Y of the walkable top surface. */
  top: number;
}

export interface NodeInteraction {
  kind: 'prompt' | 'info';
  label: string;
  /** World position of the console the player interacts with. */
  terminal: Vec3;
}

export interface NetworkNode {
  id: string;
  index: number;
  name: string;
  description: string;
  region: RegionId;
  layer: number;
  /** World-space centre of the node core. */
  position: Vec3;
  size: number;
  /** Outgoing node ids. */
  connections: string[];
  incoming: string[];
  /** Baseline idle activity, 0..1. */
  activity: number;
  visual: NodeVisual;
  /** Present for nodes on the main walkable path. */
  deck?: NodeDeck;
  interaction?: NodeInteraction;
}

export interface NetworkEdge {
  index: number;
  source: string;
  target: string;
  sourceIndex: number;
  targetIndex: number;
  /** True when both ends sit on the walkable path: rendered as a highway. */
  primary: boolean;
  weight: number;
}

export interface RegionInfo {
  id: RegionId;
  name: string;
  color: string;
  description: string;
}

export interface NetworkGraph {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  regions: Record<RegionId, RegionInfo>;
  /** Node ids per layer, ordered input -> output. */
  layers: string[][];
  /** Walkable main path, one node id per layer. */
  path: string[];
  nodeById: Map<string, NetworkNode>;
  edgeByPair: Map<string, NetworkEdge>;
  outgoing: Map<string, NetworkEdge[]>;
  center: Vec3;
  spawn: Vec3;
}
