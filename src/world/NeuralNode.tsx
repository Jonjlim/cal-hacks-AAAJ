import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';
import { QUALITY } from '../config/quality';
import { nodeActivity } from '../simulation/networkActivity';
import { useGameStore } from '../store/useGameStore';
import type { NetworkNode } from '../types/network';
import { NodeStructure } from './NodeStructure';

/**
 * One network node's procedural structure (the glowing core itself is drawn
 * instanced by NeuralNetwork). Spins faster when the node is active and
 * hides its detail beyond the quality preset's detail distance.
 */
export function NeuralNode({ node }: { node: NetworkNode }) {
  const spin = useRef<Group>(null);
  const root = useRef<Group>(null);
  const phase = node.index * 1.7;

  useFrame(({ camera }, dt) => {
    if (!root.current || !spin.current) return;
    const d = camera.position.distanceTo(root.current.position);
    const q = QUALITY[useGameStore.getState().quality];
    // The gate arches are landmarks: always render them.
    root.current.visible = node.visual.variant === 'gate' || d < q.detailDistance * 1.8;
    const act = node.activity + nodeActivity[node.index];
    if (node.visual.variant !== 'gate') spin.current.rotation.y += dt * (0.08 + act * 0.35);
    // Floating nodes bob gently; decked nodes stay put over their platform.
    if (!node.deck) root.current.position.y = node.position[1] + Math.sin(performance.now() * 0.0005 + phase) * 1.2;
  });

  return (
    <group ref={root} position={node.position}>
      <group ref={spin}>
        <NodeStructure node={node} />
      </group>
    </group>
  );
}
