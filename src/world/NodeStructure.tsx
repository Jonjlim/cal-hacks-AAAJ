import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  MeshBasicMaterial,
  Object3D,
  OctahedronGeometry,
  ShaderMaterial,
  TorusGeometry,
} from 'three';
import { MATERIALS, emissive, hdr, timeUniform } from '../materials/materials';
import type { NetworkNode } from '../types/network';

/**
 * Reusable procedural node structures. All geometry is unit-sized and shared;
 * each node scales it by its `size`. Variants share one design language:
 * dark metal frames, thin emissive lines, glass cores (rendered instanced in
 * NeuralNetwork) and rotating rings.
 */

export const GEO = {
  ringThick: new TorusGeometry(1, 0.045, 10, 96),
  ringThin: new TorusGeometry(1, 0.012, 6, 128),
  ringChunky: new TorusGeometry(1, 0.075, 12, 96),
  cube: new BoxGeometry(1, 1, 1),
  octa: new OctahedronGeometry(1),
  spire: new ConeGeometry(1, 1, 6, 1),
  spireEdges: new EdgesGeometry(new ConeGeometry(1, 1, 6, 1)),
  hex: new CylinderGeometry(1, 1, 0.22, 6),
  hexEdges: new EdgesGeometry(new CylinderGeometry(1, 1, 0.22, 6)),
  rod: new CylinderGeometry(1, 1, 1, 8),
  funnel: new CylinderGeometry(1, 0.2, 1, 18, 3, true),
  disc: new CircleGeometry(1, 64),
  tooth: new BoxGeometry(1, 1, 1),
};

const lineCache = new Map<string, LineBasicMaterial>();
function lineMat(hex: string, opacity = 0.9) {
  const k = hex + opacity;
  let m = lineCache.get(k);
  if (!m) {
    m = new LineBasicMaterial({
      color: hdr(hex, 2.2),
      transparent: true,
      opacity,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    lineCache.set(k, m);
  }
  return m;
}

/** Swirling portal membrane (shader-lab "portal" idea, written from scratch). */
const portalMaterial = new ShaderMaterial({
  uniforms: { uTime: timeUniform, uColor: { value: hdr('#9fe4ff', 0.55) } },
  transparent: true,
  depthWrite: false,
  blending: AdditiveBlending,
  side: DoubleSide,
  toneMapped: false,
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
    void main(){
      vec2 p = vUv * 2.0 - 1.0;
      float r = length(p);
      float a = atan(p.y, p.x);
      float swirl = sin(a * 6.0 + r * 14.0 - uTime * 2.2) * 0.5 + 0.5;
      float rings = sin(r * 40.0 - uTime * 3.0) * 0.5 + 0.5;
      float edge = smoothstep(0.55, 1.0, r) * (1.0 - smoothstep(0.96, 1.0, r));
      float alpha = edge * (0.35 + 0.65 * swirl) + rings * 0.05 * (1.0 - r);
      gl_FragColor = vec4(uColor * alpha, 1.0);
    }`,
});

interface VariantProps {
  node: NetworkNode;
}

/** Input/output gate: a portal tunnel of concentric rings (reference: green bridge). */
function Gate({ node }: VariantProps) {
  const s = node.size;
  const R = s * 2;
  const tunnel = [0, 4, 8, 12];
  const dir = node.layer === 0 ? 1 : -1; // tunnel recedes along the walking direction
  return (
    <group rotation={[0, Math.PI / 2, 0]}>
      <mesh geometry={GEO.ringChunky} material={MATERIALS.darkMetal} scale={[R, R, R * 1.4]} />
      <mesh geometry={GEO.ringThin} material={emissive('#cdeeff', 2.2)} scale={[R * 0.93, R * 0.93, R * 2]} />
      {tunnel.slice(1).map((dz, i) => (
        // Smaller rings drop so every ring's base sinks below the same floor line.
        <group key={dz} position={[0, -R * (0.1 + i * 0.05) - 0.4, -dz * dir]}>
          <mesh
            geometry={GEO.ringThin}
            material={i % 2 ? emissive('#43CDFF', 2) : emissive('#cdeeff', 1.8)}
            scale={[R * (0.9 - i * 0.05), R * (0.9 - i * 0.05), R * 2]}
          />
          <mesh geometry={GEO.ringChunky} material={MATERIALS.darkPanel} scale={[R * (0.97 - i * 0.05), R * (0.97 - i * 0.05), R * 0.8]} />
        </group>
      ))}
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return (
          <mesh
            key={i}
            geometry={GEO.tooth}
            material={i % 4 === 0 ? emissive(node.visual.color, 2.5) : MATERIALS.darkMetal}
            position={[Math.cos(a) * R * 1.08, Math.sin(a) * R * 1.08, 0]}
            rotation={[0, 0, a]}
            scale={[2.6, 1.4, 3.2]}
          />
        );
      })}
      <mesh geometry={GEO.disc} material={portalMaterial} scale={R * 0.9} position={[0, 0, -2 * dir]} />
    </group>
  );
}

function Tokenizer({ node }: VariantProps) {
  const s = node.size;
  const lit = useRef<InstancedMesh>(null);
  const dark = useRef<InstancedMesh>(null);
  const COUNT = 18;
  const init = useMemo(() => {
    const o = new Object3D();
    return (mesh: InstancedMesh | null, offset: number) => {
      if (!mesh) return;
      for (let i = 0; i < COUNT; i++) {
        const band = i % 3;
        const a = (i / COUNT) * Math.PI * 2 + offset;
        const r = s * (1.7 + band * 0.35);
        o.position.set(Math.cos(a) * r, (band - 1) * s * 0.45, Math.sin(a) * r);
        o.rotation.set(a, a * 2, 0);
        o.scale.setScalar(s * (0.14 + (i % 4) * 0.03));
        o.updateMatrix();
        mesh.setMatrixAt(i, o.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
  }, [s]);
  return (
    <group>
      <instancedMesh ref={(m) => { lit.current = m; init(m, 0); }} args={[GEO.cube, emissive(node.visual.color, 2.6), COUNT]} />
      <instancedMesh ref={(m) => { dark.current = m; init(m, 0.17); }} args={[GEO.cube, MATERIALS.darkMetal, COUNT]} />
    </group>
  );
}

function Embedding({ node }: VariantProps) {
  const s = node.size;
  const { matrixInit, lines } = useMemo(() => {
    const pts: number[] = [];
    const nodes: [number, number, number][] = [];
    const sp = s * 1.2;
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++) if (x || y || z) nodes.push([x * sp, y * sp, z * sp]);
    for (const a of nodes)
      for (const b of nodes) {
        const d = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
        if (d > 0 && d <= sp + 0.01 && a < b) pts.push(...a, ...b);
      }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pts, 3));
    const o = new Object3D();
    return {
      lines: g,
      matrixInit: (m: InstancedMesh | null) => {
        if (!m) return;
        nodes.forEach((p, i) => {
          o.position.set(...p);
          o.scale.setScalar(s * 0.16);
          o.updateMatrix();
          m.setMatrixAt(i, o.matrix);
        });
        m.instanceMatrix.needsUpdate = true;
      },
    };
  }, [s]);
  return (
    <group>
      <instancedMesh ref={matrixInit} args={[GEO.octa, emissive(node.visual.color, 2.8), 26]} />
      <lineSegments geometry={lines} material={lineMat(node.visual.color, 0.35)} />
    </group>
  );
}

function Attention({ node }: VariantProps) {
  const s = node.size;
  const g1 = useRef<Group>(null);
  const g2 = useRef<Group>(null);
  const g3 = useRef<Group>(null);
  useFrame((_, dt) => {
    if (g1.current) g1.current.rotation.x += dt * 0.35;
    if (g2.current) g2.current.rotation.y += dt * 0.5;
    if (g3.current) g3.current.rotation.z += dt * 0.28;
  });
  const ring = (r: number) => (
    <>
      <mesh geometry={GEO.ringThick} material={MATERIALS.darkMetal} scale={[r, r, r * 1.6]} />
      <mesh geometry={GEO.ringThin} material={emissive(node.visual.color, 3)} scale={r * 0.985} />
    </>
  );
  return (
    <group>
      <group ref={g1}>{ring(s * 1.9)}</group>
      <group ref={g2} rotation={[Math.PI / 2.6, 0, 0]}>{ring(s * 1.65)}</group>
      <group ref={g3} rotation={[0, Math.PI / 3, Math.PI / 2]}>{ring(s * 1.42)}</group>
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <group key={i} rotation={[0, a, 0.4]}>
            <mesh geometry={GEO.rod} material={emissive(node.visual.color, 1.6)} position={[s * 1.35, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[s * 0.03, s * 0.9, s * 0.03]} />
            <mesh geometry={GEO.octa} material={MATERIALS.emissiveWhite} position={[s * 1.85, 0, 0]} scale={s * 0.12} />
          </group>
        );
      })}
    </group>
  );
}

function Transformer({ node }: VariantProps) {
  const s = node.size;
  const levels = [-1.35, -0.68, 0, 0.68, 1.35];
  return (
    <group>
      <mesh geometry={GEO.rod} material={emissive(node.visual.color, 2.4)} scale={[s * 0.07, s * 3.6, s * 0.07]} />
      {levels.map((y, i) => {
        const r = s * (i % 2 ? 1.55 : 1.85);
        return (
          <group key={y} position={[0, y * s, 0]} rotation={[Math.PI / 2, 0, i * 0.4]}>
            <mesh geometry={GEO.ringChunky} material={MATERIALS.darkMetal} scale={[r, r, r * 0.8]} />
            <mesh geometry={GEO.ringThin} material={emissive(node.visual.color, 2.8)} scale={r * 0.94} />
            {Array.from({ length: 4 }, (_, j) => {
              const a = (j / 4) * Math.PI * 2 + i;
              return (
                <mesh key={j} geometry={GEO.cube} material={MATERIALS.darkPanel} position={[Math.cos(a) * r, Math.sin(a) * r, 0]} rotation={[0, 0, a]} scale={[s * 0.32, s * 0.16, s * 0.22]} />
              );
            })}
          </group>
        );
      })}
    </group>
  );
}

const outputWire = new MeshBasicMaterial({
  color: hdr('#F0C477', 1.6),
  wireframe: true,
  transparent: true,
  opacity: 0.5,
  blending: AdditiveBlending,
  depthWrite: false,
  toneMapped: false,
});

function Output({ node }: VariantProps) {
  const s = node.size;
  return (
    <group>
      <mesh geometry={GEO.funnel} material={outputWire} position={[0, s * 1.35, 0]} scale={[s * 2.1, s * 1.6, s * 2.1]} />
      <mesh geometry={GEO.funnel} material={outputWire} position={[0, -s * 1.35, 0]} rotation={[Math.PI, 0, 0]} scale={[s * 2.1, s * 1.6, s * 2.1]} />
      <mesh geometry={GEO.ringChunky} material={MATERIALS.darkMetal} rotation={[Math.PI / 2, 0, 0]} scale={[s * 2.2, s * 2.2, s * 1.4]} />
      <mesh geometry={GEO.ringThin} material={MATERIALS.emissiveGold} rotation={[Math.PI / 2, 0, 0]} scale={s * 2.12} />
    </group>
  );
}

/** Shared equatorial ring every non-gate node wears. */
function OrbitRing({ node }: VariantProps) {
  const s = node.size;
  return (
    <group rotation={[Math.PI / 2 + 0.25, 0, 0]}>
      <mesh geometry={GEO.ringThick} material={MATERIALS.darkMetal} scale={[s * 2.45, s * 2.45, s * 3]} />
      <mesh geometry={GEO.ringThin} material={emissive(node.visual.accent, 2.2)} scale={s * 2.42} />
    </group>
  );
}

/** Spire + hex shards under floating (off-path) nodes. */
function FloatingBase({ node }: VariantProps) {
  const s = node.size;
  return (
    <group>
      <group position={[0, -s * 2.6, 0]} rotation={[Math.PI, 0, 0]} scale={[s * 0.8, s * 2.4, s * 0.8]}>
        <mesh geometry={GEO.spire} material={MATERIALS.darkMetal} />
        <lineSegments geometry={GEO.spireEdges} material={lineMat(node.visual.color, 0.8)} />
      </group>
      <mesh geometry={GEO.hex} material={MATERIALS.darkMetal} position={[0, -s * 1.45, 0]} scale={[s * 1.05, s * 1.2, s * 1.05]} />
      <lineSegments geometry={GEO.hexEdges} material={lineMat(node.visual.color, 0.9)} position={[0, -s * 1.45, 0]} scale={[s * 1.05, s * 1.2, s * 1.05]} />
    </group>
  );
}

export function NodeStructure({ node }: VariantProps) {
  const v = node.visual.variant;
  return (
    <>
      {v === 'gate' && <Gate node={node} />}
      {v === 'tokenizer' && <Tokenizer node={node} />}
      {v === 'embedding' && <Embedding node={node} />}
      {v === 'attention' && <Attention node={node} />}
      {v === 'transformer' && <Transformer node={node} />}
      {v === 'output' && <Output node={node} />}
      {v !== 'gate' && <OrbitRing node={node} />}
      {!node.deck && <FloatingBase node={node} />}
    </>
  );
}
