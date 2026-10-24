import { Environment, Lightformer } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { DirectionalLight, Mesh } from 'three';
import { CameraManager } from '../camera/CameraManager';
import { ATMOSPHERE, PALETTE } from '../config/palette';
import { QUALITY } from '../config/quality';
import { CollisionEffects } from '../physics/CollisionEffects';
import { EnergyPulse } from '../physics/EnergyPulse';
import { PhysicsProps } from '../physics/PhysicsProps';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { NodePulse } from '../effects/NodePulse';
import { ParticleField } from '../effects/ParticleField';
import { PostProcessing } from '../effects/PostProcessing';
import { PromptSignal } from '../effects/PromptSignal';
import { SignalTrail } from '../effects/SignalTrail';
import { createBeamMaterial, timeUniform } from '../materials/materials';
import { PlayerController } from '../player/PlayerController';
import { runtime } from '../store/runtime';
import { settledMode, useGameStore } from '../store/useGameStore';
import { NeuralNetwork } from '../world/NeuralNetwork';
import { NodeEnvironment } from '../world/NodeEnvironment';
import { ProceduralTerrain } from '../world/ProceduralTerrain';
import { Scenery } from '../world/Scenery';
import { SkyDome } from '../world/SkyDome';

/**
 * Scene composition. Mount order matters for frame order: the player
 * (inside PhysicsWorld) updates before CameraManager reads its position.
 *
 * Visual hierarchy, brightest to dimmest: player & active signals ->
 * walkways -> nodes -> terrain -> sky.
 */
export function Scene() {
  const quality = useGameStore((s) => s.quality);
  const terrainStyle = useGameStore((s) => s.terrainStyle);
  const q = QUALITY[quality];

  return (
    <>
      <TimeTicker />
      <fogExp2 attach="fog" args={[ATMOSPHERE.fog, ATMOSPHERE.fogDensity]} />
      <Lighting shadows={q.shadows} />
      <Environment frames={1} resolution={128} background={false}>
        <Lightformer form="ring" intensity={2.5} color={PALETTE.cyan} position={[0, 6, -10]} scale={8} />
        <Lightformer form="rect" intensity={1.6} color={PALETTE.violet} position={[-10, 2, 4]} scale={[10, 4, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#e8f2ff" position={[8, 8, 6]} scale={[6, 6, 1]} />
        <Lightformer form="circle" intensity={0.6} color={PALETTE.blue} position={[0, -6, 0]} scale={14} />
      </Environment>

      <SkyDome />
      <ProceduralTerrain segments={q.terrainSegments} wireframe={terrainStyle === 'wireframe'} solidUnderlay />
      <Scenery />

      <PhysicsWorld>
        <NodeEnvironment />
        <PlayerController />
        <PhysicsProps />
      </PhysicsWorld>

      <NeuralNetwork />
      <SignalTrail />
      <ParticleField />
      <NodePulse />
      <PromptSignal />
      <CollisionEffects />
      <EnergyPulse />
      <PlayerBeacon />

      <CameraManager />
      <PostProcessing />
    </>
  );
}

function TimeTicker() {
  useFrame(({ clock }) => {
    timeUniform.value = clock.elapsedTime;
  });
  return null;
}

/** Moonlight from the planet side; on High it casts a shadow box that follows the player. */
function Lighting({ shadows }: { shadows: boolean }) {
  const sun = useRef<DirectionalLight>(null);
  useFrame(() => {
    const l = sun.current;
    if (!l) return;
    const p = runtime.player.position;
    l.position.set(p.x + 60, p.y + 90, p.z - 40);
    l.target.position.copy(p);
    l.target.updateMatrixWorld();
  });
  return (
    <>
      <hemisphereLight args={['#7766dd', '#0a1430', 0.9]} />
      <ambientLight intensity={0.25} color="#5a6fb0" />
      <directionalLight
        ref={sun}
        intensity={1.8}
        color="#dfe6ff"
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-35}
        shadow-camera-right={35}
        shadow-camera-top={35}
        shadow-camera-bottom={-35}
        shadow-camera-near={1}
        shadow-camera-far={260}
        shadow-bias={-0.0004}
      />
    </>
  );
}

const beaconMat = createBeamMaterial(PALETTE.gold, 3, 1.5);

/** "You are here" pillar marking the player in overview / focus views. */
function PlayerBeacon() {
  const ref = useRef<Mesh>(null);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const mode = useGameStore.getState().cameraMode;
    m.visible = mode !== 'EXPLORATION' || settledMode() !== 'EXPLORATION';
    const p = runtime.player.position;
    m.position.set(p.x, p.y - 1, p.z);
  });
  return (
    <mesh ref={ref} material={beaconMat} scale={[1.6, 160, 1.6]} visible={false}>
      <cylinderGeometry args={[1, 1, 1, 12, 1, true]} />
    </mesh>
  );
}
