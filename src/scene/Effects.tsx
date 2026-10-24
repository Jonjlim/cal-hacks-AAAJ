import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';

export function Effects() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom mipmapBlur intensity={1.15} luminanceThreshold={0.18} luminanceSmoothing={0.25} />
      <Vignette offset={0.25} darkness={0.75} />
    </EffectComposer>
  );
}
