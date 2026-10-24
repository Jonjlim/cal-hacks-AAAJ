import { useFrame } from '@react-three/fiber';
import {
  BallCollider,
  CoefficientCombineRule,
  RigidBody,
  type CollisionEnterPayload,
  type RapierRigidBody,
} from '@react-three/rapier';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, Color, Mesh, MeshBasicMaterial, PointLight, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { hdr, timeUniform } from '../materials/materials';
import { registerProp } from './PhysicsWorld';
import { spawnImpact } from './CollisionEffects';

/**
 * A bouncing computational orb. Restitution is configurable; every bounce is
 * a Rapier collision event that drives the visuals — glow, light and sparks
 * scale with impact speed, so physics and light read as one system.
 */

export interface EnergyOrbProps {
  position: [number, number, number];
  radius?: number;
  restitution?: number;
  color?: string;
}

const sphere = new SphereGeometry(1, 40, 28);

export function EnergyOrb({ position, radius = 0.9, restitution = 0.88, color = '#43CDFF' }: EnergyOrbProps) {
  const body = useRef<RapierRigidBody>(null);
  const light = useRef<PointLight>(null);
  const shellMesh = useRef<Mesh>(null);
  const flash = useRef(0);
  const home = useMemo(() => new Vector3(...position), [position]);

  const mats = useMemo(
    () => ({
      core: new MeshBasicMaterial({ color: hdr(color, 3), toneMapped: false }),
      shell: new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
        uniforms: { uColor: { value: new Color(color) }, uFlash: { value: 0 }, uTime: timeUniform },
        vertexShader: /* glsl */ `
          varying vec3 vN; varying vec3 vV; varying vec3 vP;
          void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix)*normal);
            vV = normalize(cameraPosition - wp.xyz); vP = position; gl_Position = projectionMatrix * viewMatrix * wp; }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor; uniform float uFlash; uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec3 vP;
          void main(){
            float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.5);
            // Plasma filaments inside the glass (neon-corridor reference).
            float fil = sin(vP.x*9.0 + uTime*3.0 + sin(vP.y*7.0)) * sin(vP.y*8.0 - uTime*2.0 + cos(vP.z*6.0));
            fil = smoothstep(0.6, 1.0, abs(fil));
            vec3 col = uColor * (f * (2.5 + uFlash * 6.0) + fil * 0.8) + vec3(0.9,0.6,1.0) * fil * 0.4;
            gl_FragColor = vec4(col, 1.0);
          }`,
      }),
    }),
    [color],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  useEffect(() => {
    if (!body.current) return;
    return registerProp(body.current, { kind: 'orb', onPulse: () => (flash.current = 1) });
  }, []);

  const onCollisionEnter = (e: CollisionEnterPayload) => {
    const b = body.current;
    if (!b) return;
    const v = b.linvel();
    const speed = Math.hypot(v.x, v.y, v.z);
    if (speed < 2) return;
    flash.current = Math.min(1, speed / 14);
    const n = e.manifold.normal();
    const p = b.translation();
    const normal = new Vector3(n.x, n.y, n.z).normalize();
    // Contact sits one radius from the centre, against the normal.
    const contact = new Vector3(p.x, p.y, p.z).addScaledVector(normal, e.flipped ? radius : -radius);
    spawnImpact(contact, color, speed / 9, normal);
  };

  useFrame((_, dt) => {
    const b = body.current;
    if (!b) return;
    flash.current = Math.max(0, flash.current - dt * 2.5);
    const v = b.linvel();
    const speed = Math.min(1, Math.hypot(v.x, v.y, v.z) / 15);
    mats.core.color.copy(hdr(color, 2.2 + speed * 3 + flash.current * 6));
    mats.shell.uniforms.uFlash.value = flash.current;
    if (light.current) light.current.intensity = 60 + speed * 120 + flash.current * 500;
    if (shellMesh.current) shellMesh.current.scale.setScalar(radius * (1 + flash.current * 0.15));
    if (b.translation().y < -40) {
      b.setTranslation(home, true);
      b.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
  });

  return (
    <RigidBody
      ref={body}
      position={position}
      colliders={false}
      linearDamping={0.05}
      angularDamping={0.2}
      onCollisionEnter={onCollisionEnter}
      ccd
    >
      <BallCollider
        args={[radius]}
        restitution={restitution}
        restitutionCombineRule={CoefficientCombineRule.Max}
        friction={0.25}
        density={0.8}
      />
      <mesh geometry={sphere} material={mats.core} scale={radius * 0.45} />
      <mesh ref={shellMesh} geometry={sphere} material={mats.shell} scale={radius} />
      <pointLight ref={light} color={color} distance={18} decay={2} intensity={60} />
    </RigidBody>
  );
}
