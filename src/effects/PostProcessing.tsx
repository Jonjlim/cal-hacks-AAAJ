import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { QUALITY } from '../config/quality';
import { useGameStore } from '../store/useGameStore';

/**
 * Bloom only catches HDR emissives (threshold 1.0), so glowing structure is
 * emphasised without washing out the dark materials. Low quality skips the
 * composer entirely and relies on the renderer's ACES tone mapping.
 */
export function PostProcessing() {
  const quality = useGameStore((s) => s.quality);
  const q = QUALITY[quality];
  if (!q.bloom) return null;
  return (
    <EffectComposer multisampling={q.multisampling}>
      <Bloom mipmapBlur intensity={q.bloomIntensity} luminanceThreshold={1} luminanceSmoothing={0.25} radius={0.72} />
      <Vignette offset={0.28} darkness={0.62} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
