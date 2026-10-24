import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  Object3D,
  RingGeometry,
  ShaderMaterial,
} from 'three';
import { GRAPH } from '../simulation/graphData';
import { pulseQueue } from '../simulation/networkActivity';

/**
 * Camera-facing shock rings when a node is activated (signal arrival,
 * interaction, pulse). Pooled; one draw call.
 */
const POOL = 32;
const LIFE = 1.1;

export function NodePulse() {
  const ref = useRef<InstancedMesh>(null);
  const res = useMemo(() => {
    const geo = new RingGeometry(0.92, 1, 64);
    geo.setAttribute('aAlpha', new InstancedBufferAttribute(new Float32Array(POOL), 1));
    geo.setAttribute('aTint', new InstancedBufferAttribute(new Float32Array(POOL * 3), 3));
    const mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      toneMapped: false,
      vertexShader: /* glsl */ `attribute float aAlpha; attribute vec3 aTint; varying float vA; varying vec3 vT;
        void main(){ vA = aAlpha; vT = aTint; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `varying float vA; varying vec3 vT; void main(){ gl_FragColor = vec4(vT * 3.0 * vA, 1.0); }`,
    });
    const slots = Array.from({ length: POOL }, () => ({ node: 0, age: LIFE, strength: 1 }));
    return { geo, mat, slots, next: 0 };
  }, []);
  const o = useMemo(() => new Object3D(), []);
  const c = useMemo(() => new Color(), []);

  useFrame(({ camera }, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const tint = res.geo.attributes.aTint as InstancedBufferAttribute;
    const alpha = res.geo.attributes.aAlpha as InstancedBufferAttribute;
    while (pulseQueue.length) {
      const ev = pulseQueue.shift()!;
      const i = res.next;
      res.next = (res.next + 1) % POOL;
      res.slots[i] = { node: ev.node, age: 0, strength: ev.strength };
      c.set(ev.color);
      tint.setXYZ(i, c.r, c.g, c.b);
    }
    res.slots.forEach((s, i) => {
      s.age += dt;
      const t = Math.min(1, s.age / LIFE);
      const n = GRAPH.nodes[s.node];
      o.position.set(...n.position);
      o.quaternion.copy(camera.quaternion);
      o.scale.setScalar(n.size * (1.4 + t * 3.5 * (0.6 + s.strength * 0.4)));
      o.updateMatrix();
      ref.current!.setMatrixAt(i, o.matrix);
      alpha.setX(i, s.age < LIFE ? Math.pow(1 - t, 2) * (0.5 + s.strength * 0.5) : 0);
    });
    tint.needsUpdate = alpha.needsUpdate = true;
    ref.current!.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={ref} args={[res.geo, res.mat, POOL]} frustumCulled={false} renderOrder={6} />;
}
