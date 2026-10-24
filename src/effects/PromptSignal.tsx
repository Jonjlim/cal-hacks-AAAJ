import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  IcosahedronGeometry,
  InstancedMesh,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Points,
  SphereGeometry,
  Vector3,
} from 'three';
import { PALETTE } from '../config/palette';
import { createBeamMaterial, createSpriteMaterial, hdr } from '../materials/materials';
import { GRAPH, nodeVec } from '../simulation/graphData';
import { MAX_TOKENS } from '../simulation/promptSimulation';
import { signalController } from '../simulation/signalController';
import { decayActivity } from '../simulation/networkActivity';
import { useGameStore } from '../store/useGameStore';

/**
 * Renders the deterministic SignalController state: the incoming prompt orb,
 * token fragments (spheres that morph into geometric embeddings), trailing
 * light, attention links between fragments, and the output beam.
 *
 * Also owns the per-frame activity decay so there is exactly one place where
 * network activity "cools down".
 */
const TRAIL = 22;

export function PromptSignal() {
  const sphereInst = useRef<InstancedMesh>(null);
  const geomInst = useRef<InstancedMesh>(null);
  const glowPts = useRef<Points>(null);
  const orb = useRef<Mesh>(null);
  const beam = useRef<Mesh>(null);
  const incoming = useRef<Mesh>(null);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const tokens = useGameStore((s) => s.prompt.tokens);

  const res = useMemo(() => {
    const glowGeo = new BufferGeometry();
    glowGeo.setAttribute('position', new BufferAttribute(new Float32Array((MAX_TOKENS + 1) * 3), 3));
    const gcol = new Float32Array((MAX_TOKENS + 1) * 3);
    const gold = new Color(PALETTE.gold).multiplyScalar(2.5);
    for (let i = 0; i <= MAX_TOKENS; i++) gcol.set([gold.r, gold.g, gold.b], i * 3);
    glowGeo.setAttribute('aColor', new BufferAttribute(gcol, 3));
    glowGeo.setAttribute('aScale', new BufferAttribute(new Float32Array(MAX_TOKENS + 1), 1));

    const trailGeo = new BufferGeometry();
    trailGeo.setAttribute('position', new BufferAttribute(new Float32Array(MAX_TOKENS * (TRAIL - 1) * 2 * 3), 3));
    trailGeo.setAttribute('color', new BufferAttribute(new Float32Array(MAX_TOKENS * (TRAIL - 1) * 2 * 3), 3));

    const pairs = (MAX_TOKENS * (MAX_TOKENS - 1)) / 2;
    const attnGeo = new BufferGeometry();
    attnGeo.setAttribute('position', new BufferAttribute(new Float32Array(pairs * 2 * 3), 3));
    attnGeo.setAttribute('color', new BufferAttribute(new Float32Array(pairs * 2 * 3), 3));

    const lineMat = () =>
      new LineBasicMaterial({ vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false });

    return {
      sphere: new SphereGeometry(1, 20, 14),
      ico: new IcosahedronGeometry(1, 0),
      fragMat: new MeshBasicMaterial({ color: hdr(PALETTE.gold, 4), toneMapped: false }),
      geoMat: new MeshBasicMaterial({ color: hdr(PALETTE.white, 3.4), toneMapped: false, wireframe: true }),
      orbMat: new MeshBasicMaterial({ color: hdr(PALETTE.gold, 6), toneMapped: false }),
      glowGeo,
      glowMat: createSpriteMaterial({ size: 3.2, minPx: 7, maxPx: 90 }),
      trailGeo,
      trailMat: lineMat(),
      attnGeo,
      attnMat: lineMat(),
      beamMat: createBeamMaterial(PALETTE.gold, 3, 2),
      history: Array.from({ length: MAX_TOKENS }, () => Array.from({ length: TRAIL }, () => new Vector3())),
      warm: false,
    };
  }, []);

  useEffect(
    () => () => {
      Object.values(res).forEach((v) => {
        if (v && typeof (v as { dispose?: () => void }).dispose === 'function') (v as { dispose: () => void }).dispose();
      });
    },
    [res],
  );

  const o = useMemo(() => new Object3D(), []);
  const gold = useMemo(() => new Color(PALETTE.gold), []);
  const violet = useMemo(() => new Color(PALETTE.violet), []);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    decayActivity(dt);
    signalController.update(dt);
    const sc = signalController;
    const n = sc.fragments.length;
    res.glowMat.uniforms.uViewport.value = state.size.height * state.viewport.dpr;

    // --- fragments
    const glowPos = res.glowGeo.attributes.position as BufferAttribute;
    const glowScale = res.glowGeo.attributes.aScale as BufferAttribute;
    for (let k = 0; k < MAX_TOKENS; k++) {
      const f = sc.fragments[k];
      const vis = !!f && f.visible;
      const sphereScale = vis ? 0.9 * (1 - f.morph) : 0;
      const geoScale = vis ? 1.3 * f.morph : 0;
      if (vis) {
        o.position.copy(f.position);
        o.rotation.set(state.clock.elapsedTime * 1.3 + k, state.clock.elapsedTime * 0.9, 0);
      } else o.position.set(0, -9999, 0);
      o.scale.setScalar(Math.max(sphereScale, 0.0001));
      o.updateMatrix();
      sphereInst.current!.setMatrixAt(k, o.matrix);
      o.scale.setScalar(Math.max(geoScale, 0.0001));
      o.updateMatrix();
      geomInst.current!.setMatrixAt(k, o.matrix);
      glowPos.setXYZ(k, o.position.x, o.position.y, o.position.z);
      glowScale.setX(k, vis ? 0.8 : 0);

      // trail history
      const h = res.history[k];
      if (vis) {
        if (!res.warm) h.forEach((p) => p.copy(f.position));
        for (let j = TRAIL - 1; j > 0; j--) h[j].copy(h[j - 1]);
        h[0].copy(f.position);
      }
      const tp = res.trailGeo.attributes.position as BufferAttribute;
      const tc = res.trailGeo.attributes.color as BufferAttribute;
      for (let j = 0; j < TRAIL - 1; j++) {
        const idx = (k * (TRAIL - 1) + j) * 2;
        const a = vis ? (1 - j / TRAIL) * 1.6 : 0;
        const b = vis ? (1 - (j + 1) / TRAIL) * 1.6 : 0;
        tp.setXYZ(idx, h[j].x, h[j].y, h[j].z);
        tp.setXYZ(idx + 1, h[j + 1].x, h[j + 1].y, h[j + 1].z);
        tc.setXYZ(idx, gold.r * a, gold.g * a, gold.b * a);
        tc.setXYZ(idx + 1, gold.r * b, gold.g * b, gold.b * b);
      }
      tp.needsUpdate = tc.needsUpdate = true;

      const label = labelRefs.current[k];
      if (label) label.style.opacity = vis && f.morph < 1 ? '1' : vis ? '0.75' : '0';
    }
    res.warm = n > 0;
    sphereInst.current!.instanceMatrix.needsUpdate = true;
    geomInst.current!.instanceMatrix.needsUpdate = true;

    // --- orb
    const orbVis = sc.orb.visible;
    orb.current!.visible = orbVis;
    if (orbVis) {
      orb.current!.position.copy(sc.orb.position);
      orb.current!.scale.setScalar(sc.orb.scale);
    }
    glowPos.setXYZ(MAX_TOKENS, sc.orb.position.x, sc.orb.position.y, sc.orb.position.z);
    glowScale.setX(MAX_TOKENS, orbVis ? 2.2 : 0);
    glowPos.needsUpdate = glowScale.needsUpdate = true;

    // --- incoming stream from the sky into the input gate
    const inc = incoming.current!;
    inc.visible = sc.incoming > 0.01;
    if (inc.visible) {
      const gate = nodeVec(GRAPH.path[0]);
      const from = gate.clone().add(new Vector3(110, 230, -90));
      const mid = from.clone().add(gate).multiplyScalar(0.5);
      inc.position.copy(mid);
      inc.lookAt(gate);
      inc.rotateX(Math.PI / 2);
      inc.scale.set(0.8 * sc.incoming, from.distanceTo(gate), 0.8 * sc.incoming);
    }

    // --- attention links
    const ap = res.attnGeo.attributes.position as BufferAttribute;
    const ac = res.attnGeo.attributes.color as BufferAttribute;
    let s = 0;
    const att = sc.trace?.attention;
    for (let i = 0; i < MAX_TOKENS; i++) {
      for (let j = 0; j < i; j++) {
        const on = att && i < n && sc.attention > 0;
        const w = on ? att[i][j] * sc.attention * (0.7 + 0.3 * Math.sin(state.clock.elapsedTime * 8 + i + j)) * 5 : 0;
        const a = sc.fragments[i]?.position;
        const b = sc.fragments[j]?.position;
        if (on && a && b) {
          ap.setXYZ(s * 2, a.x, a.y, a.z);
          ap.setXYZ(s * 2 + 1, b.x, b.y, b.z);
        } else {
          ap.setXYZ(s * 2, 0, -9999, 0);
          ap.setXYZ(s * 2 + 1, 0, -9999, 0);
        }
        ac.setXYZ(s * 2, violet.r * w, violet.g * w, violet.b * w);
        ac.setXYZ(s * 2 + 1, gold.r * w, gold.g * w, gold.b * w);
        s++;
      }
    }
    ap.needsUpdate = ac.needsUpdate = true;

    // --- output beam
    const bm = beam.current!;
    bm.visible = sc.outputBeam > 0.01;
    if (bm.visible) {
      const out = nodeVec(GRAPH.path[GRAPH.path.length - 1]);
      bm.position.set(out.x + 300 * sc.outputBeam, out.y, out.z);
      bm.scale.set(2.2, 600 * sc.outputBeam, 2.2);
      res.beamMat.uniforms.uOpacity.value = Math.min(1, sc.outputBeam * 1.5);
    }
  });

  return (
    <group>
      <instancedMesh ref={sphereInst} args={[res.sphere, res.fragMat, MAX_TOKENS]} frustumCulled={false} />
      <instancedMesh ref={geomInst} args={[res.ico, res.geoMat, MAX_TOKENS]} frustumCulled={false} />
      <points ref={glowPts} geometry={res.glowGeo} material={res.glowMat} frustumCulled={false} renderOrder={7} />
      <lineSegments geometry={res.trailGeo} material={res.trailMat} frustumCulled={false} />
      <lineSegments geometry={res.attnGeo} material={res.attnMat} frustumCulled={false} />
      <mesh ref={orb} geometry={res.sphere} material={res.orbMat} visible={false} />
      <mesh ref={incoming} visible={false} material={res.beamMat}>
        <cylinderGeometry args={[1, 1, 1, 12, 1, true]} />
      </mesh>
      <mesh ref={beam} visible={false} material={res.beamMat} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[1, 1, 1, 16, 1, true]} />
      </mesh>
      {tokens.map((t, k) => (
        <TokenLabel key={`${k}-${t}`} index={k} text={t} refs={labelRefs} />
      ))}
    </group>
  );
}

function TokenLabel({ index, text, refs }: { index: number; text: string; refs: React.MutableRefObject<(HTMLDivElement | null)[]> }) {
  const group = useRef<Object3D>(null);
  useFrame(() => {
    const f = signalController.fragments[index];
    if (f && group.current) group.current.position.copy(f.position).add(new Vector3(0, 2.4, 0));
  });
  return (
    <object3D ref={group}>
      <Html center zIndexRange={[11, 0]}>
        <div
          className="token-label"
          ref={(el) => {
            refs.current[index] = el;
          }}
        >
          {text}
        </div>
      </Html>
    </object3D>
  );
}
