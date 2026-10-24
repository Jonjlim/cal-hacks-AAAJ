import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BoxGeometry,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  RingGeometry,
  ShaderMaterial,
  TubeGeometry,
  Vector3,
} from 'three';
import { PALETTE } from '../config/palette';
import { QUALITY } from '../config/quality';
import { FOG_GLSL, createBeamMaterial, hdr, timeUniform } from '../materials/materials';
import { GRAPH } from '../simulation/graphData';
import { rng } from '../simulation/noise';
import { useGameStore } from '../store/useGameStore';
import { DEFAULT_TERRAIN, terrainHeight } from './terrainField';

/**
 * Environmental dressing that gives scale without cluttering the network:
 *  - a hazy "cloud city" of translucent towers in the valley (green-bridge ref)
 *  - a glowing route snaking to a horizon destination beacon (network-city ref)
 *  - drifting asteroids (green-bridge ref)
 */
export function Scenery() {
  return (
    <group>
      <CloudCity />
      <GroundRoute />
      <Asteroids />
      <DestinationBeacon />
    </group>
  );
}

const FLOOR = DEFAULT_TERRAIN.center[1];

/** Towers stand in the flat valley floor, where the animated terrain barely moves. */
function CloudCity() {
  const ref = useRef<InstancedMesh>(null);
  const quality = useGameStore((s) => s.quality);
  const perCluster = QUALITY[quality].cityTowersPerCluster;

  const { geo, mat, count } = useMemo(() => {
    const r = rng(7);
    const towers: { x: number; z: number; w: number; d: number; h: number; tint: number }[] = [];
    // Clusters beneath each layer + a long avenue toward the horizon.
    const anchors: [number, number][] = [];
    for (let l = 0; l < GRAPH.layers.length; l++) {
      const x = GRAPH.nodeById.get(GRAPH.path[l])!.position[0];
      anchors.push([x, -170], [x, 170], [x + 70, -260], [x + 70, 260]);
    }
    for (let x = 700; x < 2600; x += 140) anchors.push([x, -150 - r() * 120], [x, 150 + r() * 120]);
    for (const [ax, az] of anchors) {
      for (let i = 0; i < perCluster; i++) {
        const a = r() * Math.PI * 2;
        const rad = r() * 70;
        const x = ax + Math.cos(a) * rad;
        const z = az + Math.sin(a) * rad;
        if (Math.abs(z) < 40) continue; // keep the route clear
        towers.push({ x, z, w: 5 + r() * 10, d: 5 + r() * 10, h: 30 + Math.pow(r(), 2.5) * 110, tint: r() });
      }
    }
    const geo = new BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const tints = new Float32Array(towers.length);
    towers.forEach((t, i) => (tints[i] = t.tint));
    geo.setAttribute('aTint', new InstancedBufferAttribute(tints, 1));
    const mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
      uniforms: {
        uTime: timeUniform,
        uFloor: { value: FLOOR },
        uCyan: { value: new Color('#2fb6d6') },
        uViolet: { value: new Color(PALETTE.violet) },
      },
      vertexShader: /* glsl */ `
        attribute float aTint; varying float vTint; varying vec3 vW; varying vec3 vLocal; varying float vDist; varying vec3 vScale;
        void main() {
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vW = wp.xyz; vLocal = position; vTint = aTint;
          vScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
          vDist = distance(wp.xyz, cameraPosition);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uFloor; uniform vec3 uCyan; uniform vec3 uViolet;
        varying float vTint; varying vec3 vW; varying vec3 vLocal; varying float vDist; varying vec3 vScale;
        ${FOG_GLSL}
        void main() {
          // Window grid in world units.
          vec2 cell = vec2((vLocal.x + vLocal.z) * max(vScale.x, vScale.z) / 3.0, vW.y / 4.0);
          vec2 g = fract(cell);
          float win = step(0.25, g.x) * step(g.x, 0.75) * step(0.3, g.y) * step(g.y, 0.8);
          float lit = step(0.55, fract(sin(dot(floor(cell), vec2(12.9898, 78.233)) + vTint * 10.0) * 43758.5453));
          // Height haze: towers dissolve into fog toward their base (cloud city).
          float height01 = clamp((vW.y - uFloor) / 220.0, 0.0, 1.0);
          float haze = smoothstep(0.0, 0.9, height01);
          vec3 tint = mix(uCyan, uViolet, step(0.78, vTint));
          vec3 col = tint * (0.03 + 0.1 * haze) + tint * win * lit * 0.3 * haze;
          float topEdge = smoothstep(0.985, 1.0, vLocal.y);
          col += tint * topEdge * 0.45;
          float far = 1.0 - smoothstep(1800.0, 3200.0, vDist);
          gl_FragColor = vec4(col * far, 1.0);
        }`,
    });
    const count = towers.length;
    // Matrices are applied in the effect below.
    geo.userData = { towers, o: new Object3D() };
    return { geo, mat, count };
  }, [perCluster]);

  useEffect(() => {
    const { towers, o } = geo.userData as {
      towers: { x: number; z: number; w: number; d: number; h: number }[];
      o: Object3D;
    };
    towers.forEach((t, i) => {
      o.position.set(t.x, terrainHeight(t.x, t.z) - 6, t.z);
      o.scale.set(t.w, t.h, t.d);
      o.updateMatrix();
      ref.current!.setMatrixAt(i, o.matrix);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    ref.current!.computeBoundingSphere();
    return () => {
      geo.dispose();
      mat.dispose();
    };
  }, [geo, mat]);

  return <instancedMesh key={count} ref={ref} args={[geo, mat, count]} renderOrder={0} />;
}

/** Route ribbon on the valley floor + concentric hop rings under every layer. */
function GroundRoute() {
  const { tube, rings } = useMemo(() => {
    const pts: Vector3[] = [];
    for (let x = -800; x <= 2700; x += 50) {
      const z = Math.sin(x * 0.0045) * 26 + Math.sin(x * 0.011) * 9;
      pts.push(new Vector3(x, terrainHeight(x, z) + 2, z));
    }
    const curve = new CatmullRomCurve3(pts);
    const tube = new TubeGeometry(curve, 600, 1.6, 6, false);
    const rings = GRAPH.path.map((id) => {
      const n = GRAPH.nodeById.get(id)!;
      const x = n.position[0];
      const z = Math.sin(x * 0.0045) * 26 + Math.sin(x * 0.011) * 9;
      return new Vector3(x, terrainHeight(x, z) + 2.5, z);
    });
    return { tube, rings };
  }, []);
  const ringGeo = useMemo(() => new RingGeometry(0.8, 1, 64), []);
  return (
    <group>
      <mesh geometry={tube}>
        <meshBasicMaterial color={hdr(PALETTE.cyan, 2.2)} toneMapped={false} />
      </mesh>
      {rings.map((p, i) => (
        <group key={i} position={p} rotation={[-Math.PI / 2, 0, 0]}>
          {[10, 16, 24].map((r, k) => (
            <mesh key={r} geometry={ringGeo} scale={r} position={[0, 0, k * 0.2]}>
              <meshBasicMaterial
                color={hdr(k === 0 ? PALETTE.white : PALETTE.cyan, k === 0 ? 2.4 : 1.4)}
                toneMapped={false}
                transparent
                opacity={0.8}
                side={DoubleSide}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** Bright destination star on the horizon where the route ends. */
function DestinationBeacon() {
  const beam = useMemo(() => createBeamMaterial(PALETTE.white, 2.2, 0.5), []);
  const flare = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (flare.current) flare.current.scale.setScalar(26 + Math.sin(clock.elapsedTime * 2) * 3);
  });
  const x = 2650;
  const y = terrainHeight(x, 0);
  return (
    <group position={[x, y, 0]}>
      <mesh material={beam} scale={[6, 900, 6]}>
        <cylinderGeometry args={[1, 1, 1, 16, 1, true]} />
      </mesh>
      <mesh ref={flare} position={[0, 30, 0]}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshBasicMaterial color={hdr(PALETTE.white, 6)} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Low-poly drifting rocks; one instanced draw call. */
function Asteroids() {
  const ref = useRef<InstancedMesh>(null);
  const data = useMemo(() => {
    const r = rng(99);
    return Array.from({ length: 38 }, () => {
      const side = r() < 0.5 ? -1 : 1;
      return {
        p: new Vector3(-700 + r() * 1600, 90 + r() * 160, side * (140 + r() * 380)),
        s: 4 + Math.pow(r(), 2) * 22,
        rot: new Vector3(r(), r(), r()),
        spin: 0.05 + r() * 0.15,
        bob: r() * 10,
      };
    });
  }, []);
  const geo = useMemo(() => {
    const g = new IcosahedronGeometry(1, 1);
    const pos = g.attributes.position;
    const r = rng(5);
    for (let i = 0; i < pos.count; i++) {
      const k = 0.75 + r() * 0.5;
      pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.85, pos.getZ(i) * k);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  const mat = useMemo(() => new MeshStandardMaterial({ color: '#6e5a52', roughness: 0.95, metalness: 0.05, flatShading: true }), []);
  const o = useMemo(() => new Object3D(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    data.forEach((a, i) => {
      o.position.copy(a.p);
      o.position.y += Math.sin(t * 0.2 + a.bob) * 3;
      o.rotation.set(a.rot.x + t * a.spin, a.rot.y + t * a.spin * 0.7, a.rot.z);
      o.scale.setScalar(a.s);
      o.updateMatrix();
      ref.current!.setMatrixAt(i, o.matrix);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, mat, data.length]} frustumCulled={false} />;
}
