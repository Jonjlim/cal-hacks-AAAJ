import { GRAPH } from '../simulation/graphData';
import { EnergyOrb } from './EnergyOrb';
import { InteractiveFragment } from './InteractiveFragment';

/**
 * Placement of the physical gameplay props. Few, deliberate, and close to
 * where the player starts so the interactions are discovered immediately:
 *  - a stack of cache blocks beside the spawn (scatters on pulse / impact)
 *  - a heavy data fragment at the bridge entrance (push it along the highway)
 *  - a bouncing energy orb dropped onto the deck at load
 *  - a second cluster on the Tokenizer Hub deck
 */
export function PhysicsProps() {
  const gate = GRAPH.nodeById.get(GRAPH.path[0])!;
  const tok = GRAPH.nodeById.get(GRAPH.path[1])!;
  const [gx, , gz] = gate.position;
  const gt = gate.deck!.top;
  const [tx, , tz] = tok.position;
  const tt = tok.deck!.top;

  // Pyramid stack: 3 + 2 + 1 cubes.
  const stack: [number, number, number][] = [];
  const s = 1.45;
  [3, 2, 1].forEach((n, row) => {
    for (let i = 0; i < n; i++) stack.push([gx + 14 + (i - (n - 1) / 2) * s, gt + 0.72 + row * s, gz - 12]);
  });

  return (
    <group>
      {stack.map((p, i) => (
        <InteractiveFragment key={`stack-${i}`} position={p} shape="cube" size={1} color={i % 2 ? '#8A70E9' : '#43CDFF'} density={0.6} />
      ))}
      <InteractiveFragment position={[gx + 21, gt + 1.6, gz + 1]} shape="octa" size={1.6} color="#43CDFF" density={1.4} />
      <InteractiveFragment position={[gx + 12, gt + 1.2, gz + 7]} shape="tetra" size={1.1} color="#EAF8FF" />
      <EnergyOrb position={[gx + 17, gt + 12, gz + 5]} radius={0.9} restitution={0.88} />
      <InteractiveFragment position={[tx - 6, tt + 1.4, tz - 8]} shape="octa" size={1.3} color="#8A70E9" />
      <InteractiveFragment position={[tx + 4, tt + 1.2, tz + 7]} shape="cube" size={1} color="#43CDFF" />
      <EnergyOrb position={[tx, tt + 14, tz - 3]} radius={1.2} restitution={0.92} color="#8A70E9" />
    </group>
  );
}
