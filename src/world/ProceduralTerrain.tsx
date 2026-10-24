import { useFrame } from '@react-three/fiber';
import { HeightfieldCollider, RigidBody } from '@react-three/rapier';
import { useEffect, useMemo } from 'react';
import { PlaneGeometry } from 'three';
import { DEFAULT_TERRAIN, terrainShaderHeight, type TerrainParams } from './terrainField';
import {
  DEFAULT_LOOK,
  createTerrainSolidMaterial,
  createTerrainWireMaterial,
  type TerrainLook,
} from './TerrainMaterials';

export interface ProceduralTerrainProps extends Partial<TerrainParams>, Partial<TerrainLook> {
  /** Grid subdivisions along each axis (wireframe density / level of detail). */
  segments?: number;
  /** Render triangle wireframe (Shader Lab look) or only the dark solid body. */
  wireframe?: boolean;
  /** Dark solid pass under the wires. */
  solidUnderlay?: boolean;
  /**
   * 'none'   — visual only; gameplay happens on static platforms above (default).
   * 'static' — adds a Rapier heightfield sampled from the CPU twin at t = 0.
   *            Only matches the visuals when `speed` is 0, so it forces speed 0.
   */
  collision?: 'none' | 'static';
  collisionResolution?: number;
}

/**
 * Luminous animated wireframe landscape beneath the network. All relief is
 * computed in the vertex shader every frame; the geometry is a flat plane.
 */
export function ProceduralTerrain(props: ProceduralTerrainProps) {
  const {
    segments = 240,
    wireframe = true,
    solidUnderlay = true,
    collision = 'none',
    collisionResolution = 96,
  } = props;

  const params: TerrainParams = useMemo(
    () => ({
      width: props.width ?? DEFAULT_TERRAIN.width,
      depth: props.depth ?? DEFAULT_TERRAIN.depth,
      center: props.center ?? DEFAULT_TERRAIN.center,
      height: props.height ?? DEFAULT_TERRAIN.height,
      noiseScale: props.noiseScale ?? DEFAULT_TERRAIN.noiseScale,
      speed: collision === 'static' ? 0 : (props.speed ?? DEFAULT_TERRAIN.speed),
      valley: props.valley ?? DEFAULT_TERRAIN.valley,
    }),
    [props.width, props.depth, props.center, props.height, props.noiseScale, props.speed, props.valley, collision],
  );
  const look: TerrainLook = {
    lowColor: props.lowColor ?? DEFAULT_LOOK.lowColor,
    highColor: props.highColor ?? DEFAULT_LOOK.highColor,
    peakColor: props.peakColor ?? DEFAULT_LOOK.peakColor,
    fillColor: props.fillColor ?? DEFAULT_LOOK.fillColor,
    emission: props.emission ?? DEFAULT_LOOK.emission,
    fadeStart: props.fadeStart ?? DEFAULT_LOOK.fadeStart,
    fadeEnd: props.fadeEnd ?? DEFAULT_LOOK.fadeEnd,
  };

  const time = useMemo(() => ({ value: 0 }), []);

  const geometry = useMemo(() => {
    // Shader Lab used 200x300 segments on a 60x90 plane; density scales with quality.
    const g = new PlaneGeometry(params.width, params.depth, segments, Math.round(segments * (params.depth / params.width)));
    g.rotateX(-Math.PI / 2);
    // Bounds must include displaced heights or the mesh gets frustum-culled.
    g.computeBoundingSphere();
    g.boundingSphere!.radius += params.height * 8;
    return g;
  }, [params.width, params.depth, params.height, segments]);

  const wireMat = useMemo(() => createTerrainWireMaterial(params, look, time), // eslint-disable-line react-hooks/exhaustive-deps
    [params, look.lowColor, look.highColor, look.peakColor, look.emission, look.fadeStart, look.fadeEnd, time]);
  const solidMat = useMemo(() => createTerrainSolidMaterial(params, look, time), // eslint-disable-line react-hooks/exhaustive-deps
    [params, look.fillColor, look.highColor, look.fadeStart, look.fadeEnd, time]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => wireMat.dispose(), [wireMat]);
  useEffect(() => () => solidMat.dispose(), [solidMat]);

  useFrame((_, dt) => {
    time.value += dt;
  });

  return (
    <group position={params.center}>
      {solidUnderlay && <mesh geometry={geometry} material={solidMat} renderOrder={-1} />}
      {wireframe && <mesh geometry={geometry} material={wireMat} renderOrder={1} />}
      {collision === 'static' && <TerrainHeightfield params={params} resolution={collisionResolution} />}
    </group>
  );
}

/** Static Rapier heightfield built from the CPU twin of the shader. */
function TerrainHeightfield({ params, resolution }: { params: TerrainParams; resolution: number }) {
  const heights = useMemo(() => {
    const n = resolution;
    const out: number[] = [];
    // Rapier heightfields are column-major: index = col * (rows + 1) + row, X along rows.
    for (let ix = 0; ix <= n; ix++) {
      for (let iz = 0; iz <= n; iz++) {
        const x = params.center[0] - params.width / 2 + (ix / n) * params.width;
        const z = params.center[2] - params.depth / 2 + (iz / n) * params.depth;
        out.push(terrainShaderHeight(x, z, 0, params) * params.height);
      }
    }
    return out;
  }, [params, resolution]);
  return (
    <RigidBody type="fixed" colliders={false}>
      <HeightfieldCollider
        args={[resolution, resolution, heights, { x: params.width, y: 1, z: params.depth }]}
      />
    </RigidBody>
  );
}
