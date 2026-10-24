import { useAppStore } from '@/state';
import { Environment } from './Environment';
import { AttentionArcs } from './flow/AttentionArcs';
import { AttentionMatrix } from './flow/AttentionMatrix';
import { AutoregressiveLoop } from './flow/AutoregressiveLoop';
import { KVCacheTiles } from './flow/KVCacheTiles';
import { ResidualLanes } from './flow/ResidualLanes';
import { TokenPackets } from './flow/TokenPackets';
import { EmbeddingTable } from './stations/EmbeddingTable';
import { InputTerminal } from './stations/InputTerminal';
import { LmHead } from './stations/LmHead';
import { OutputScreen } from './stations/OutputScreen';
import { Sampler } from './stations/Sampler';
import { TokenizerGate } from './stations/TokenizerGate';
import { LayerBlock } from './transformer/LayerBlock';

/** Everything in the world, in pipeline order. */
export function World() {
  const nLayers = useAppStore((s) => s.trace.model.nLayers);
  return (
    <>
      <Environment />
      <InputTerminal />
      <TokenizerGate />
      <EmbeddingTable />
      <ResidualLanes />
      {Array.from({ length: nLayers }, (_, l) => (
        <LayerBlock key={l} layer={l} />
      ))}
      <KVCacheTiles />
      <AttentionArcs />
      <AttentionMatrix />
      <LmHead />
      <Sampler />
      <OutputScreen />
      <AutoregressiveLoop />
      <TokenPackets />
    </>
  );
}
