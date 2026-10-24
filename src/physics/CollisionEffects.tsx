import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  InstancedBufferAttribute,
  InstancedMesh,
  Object3D,
  Points,
  RingGeometry,
  ShaderMaterial,
  AdditiveBlending,
  DoubleSide,
  Vector3,
} from 'three';
import { createSpriteMaterial } from '../materials/materials';

/**
 * Pooled impact feedback for physics events: spark bursts + a short flat
 * shock ring. Any system calls `spawnImpact()`; rendering is batched into two
 * draw calls regardless of how many impacts happen.
 */

interface Impact {
  position: Vector3;
  color: string;
  strength: number;
  /** Ring normal (contact normal); defaults to up. */
  normal?: Vector3;
}

const queue: Impact[] = [];

export function spawnImpact(position: Vector3, color: string, strength = 1, normal?: Vector3) {
  queue.push({ position: position.clone(), color, strength: Math.min(2, strength), normal: normal?.clone() });
}

const SPARKS = 320;
const RINGS = 12;
const SPARK_LIFE = 0.7;
const RING_LIFE = 0.5;

export function CollisionEffects() {
  const points = useRef<Points>(null);
  const rings = useRef<InstancedMesh>(null);

  const spark = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(SPARKS * 3), 3));
    geo.setAttribute('aColor', new BufferAttribute(new Float32Array(SPARKS * 3), 3));
    geo.setAttribute('aScale', new BufferAttribute(new Float32Array(SPARKS), 1));
    return {
      geo,
      mat: createSpriteMaterial({ size: 0.35, minPx: 2, maxPx: 22 }),
      vel: new Float32Array(SPARKS * 3),
      life: new Float32Array(SPARKS),
      next: 0,
    };
  }, []);

  const ring = useMemo(() => {
    const geo = new RingGeometry(0.85, 1, 48);
    geo.setAttribute('aAlpha', new InstancedBufferAttribute(new Float32Array(RINGS), 1));
    geo.setAttribute('aTint', new InstancedBufferAttribute(new Float32Array(RINGS * 3), 3));
    const mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      toneMapped: false,
      vertexShader: /* glsl */ `
        attribute float aAlpha; attribute vec3 aTint; varying float vA; varying vec3 vT;
        void main(){ vA = aAlpha; vT = aTint; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `varying float vA; varying vec3 vT; void main(){ gl_FragColor = vec4(vT * 3.0 * vA, 1.0); }`,
    });
    return {
      geo,
      mat,
      state: Array.from({ length: RINGS }, () => ({ age: RING_LIFE, pos: new Vector3(), normal: new Vector3(0, 1, 0), size: 1 })),
      next: 0,
    };
  }, []);

  const c = useMemo(() => new Color(), []);
  const o = useMemo(() => new Object3D(), []);
  const up = useMemo(() => new Vector3(0, 0, 1), []);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    spark.mat.uniforms.uViewport.value = state.size.height * state.viewport.dpr;
    const pos = spark.geo.attributes.position as BufferAttribute;
    const col = spark.geo.attributes.aColor as BufferAttribute;
    const scl = spark.geo.attributes.aScale as BufferAttribute;

    // Emit queued impacts.
    while (queue.length) {
      const imp = queue.shift()!;
      c.set(imp.color);
      const n = Math.round(10 + imp.strength * 18);
      for (let k = 0; k < n; k++) {
        const i = spark.next;
        spark.next = (spark.next + 1) % SPARKS;
        pos.setXYZ(i, imp.position.x, imp.position.y, imp.position.z);
        const sp = (3 + Math.random() * 8) * (0.5 + imp.strength * 0.5);
        const th = Math.random() * Math.PI * 2;
        const ph = Math.random() * Math.PI * 0.5;
        spark.vel.set([Math.cos(th) * Math.cos(ph) * sp, Math.sin(ph) * sp + 2, Math.sin(th) * Math.cos(ph) * sp], i * 3);
        spark.life[i] = SPARK_LIFE * (0.6 + Math.random() * 0.4);
        col.setXYZ(i, c.r * 2.5, c.g * 2.5, c.b * 2.5);
      }
      const r = ring.state[ring.next];
      ring.next = (ring.next + 1) % RINGS;
      r.age = 0;
      r.pos.copy(imp.position);
      r.normal.copy(imp.normal ?? new Vector3(0, 1, 0));
      r.size = 1.2 + imp.strength * 2.2;
      (ring.geo.attributes.aTint as InstancedBufferAttribute).setXYZ(ring.next === 0 ? RINGS - 1 : ring.next - 1, c.r, c.g, c.b);
    }

    // Integrate sparks.
    for (let i = 0; i < SPARKS; i++) {
      if (spark.life[i] <= 0) {
        scl.setX(i, 0);
        continue;
      }
      spark.life[i] -= dt;
      spark.vel[i * 3 + 1] -= 22 * dt;
      pos.setXYZ(
        i,
        pos.getX(i) + spark.vel[i * 3] * dt,
        pos.getY(i) + spark.vel[i * 3 + 1] * dt,
        pos.getZ(i) + spark.vel[i * 3 + 2] * dt,
      );
      scl.setX(i, Math.max(0, spark.life[i] / SPARK_LIFE));
    }
    pos.needsUpdate = col.needsUpdate = scl.needsUpdate = true;

    // Rings.
    const alpha = ring.geo.attributes.aAlpha as InstancedBufferAttribute;
    ring.state.forEach((r, i) => {
      r.age += dt;
      const t = Math.min(1, r.age / RING_LIFE);
      alpha.setX(i, r.age < RING_LIFE ? (1 - t) * (1 - t) : 0);
      o.position.copy(r.pos).addScaledVector(r.normal, 0.05);
      o.quaternion.setFromUnitVectors(up, r.normal);
      o.scale.setScalar(r.size * (0.3 + t * 1.6));
      o.updateMatrix();
      rings.current!.setMatrixAt(i, o.matrix);
    });
    alpha.needsUpdate = true;
    (ring.geo.attributes.aTint as InstancedBufferAttribute).needsUpdate = true;
    rings.current!.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <points ref={points} geometry={spark.geo} material={spark.mat} frustumCulled={false} />
      <instancedMesh ref={rings} args={[ring.geo, ring.mat, RINGS]} frustumCulled={false} />
    </>
  );
}
