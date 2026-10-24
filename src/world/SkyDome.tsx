import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  Points,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { ATMOSPHERE } from '../config/palette';
import { QUALITY } from '../config/quality';
import { timeUniform } from '../materials/materials';
import { rng } from '../simulation/noise';
import { useGameStore } from '../store/useGameStore';

/**
 * Background layers: gradient sky with nebula, twinkling stars and banded
 * planets on the horizon (reference: purple network world). Sky and stars
 * follow the camera so they never clip; planets are fixed for parallax.
 */

const SUN_DIR = new Vector3(0.75, 0.18, -0.62).normalize();

export function SkyDome() {
  const dome = useRef<Mesh>(null);
  const stars = useRef<Points>(null);
  const quality = useGameStore((s) => s.quality);

  const skyMat = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        depthTest: false,
        uniforms: {
          uZenith: { value: new Color(ATMOSPHERE.zenith) },
          uMid: { value: new Color('#10274D') },
          uHorizon: { value: new Color(ATMOSPHERE.horizon) },
          uGlow: { value: new Color(ATMOSPHERE.horizonGlow) },
          uSun: { value: SUN_DIR },
          uTime: timeUniform,
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uZenith; uniform vec3 uMid; uniform vec3 uHorizon; uniform vec3 uGlow; uniform vec3 uSun; uniform float uTime;
          varying vec3 vDir;
          float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float n(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
            return mix(mix(h(i),h(i+vec2(1,0)),u.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x), u.y); }
          float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*n(p); p*=2.03; a*=0.5; } return v; }
          void main() {
            vec3 d = normalize(vDir);
            float y = d.y;
            vec3 col = mix(uHorizon, uMid, smoothstep(-0.02, 0.28, y));
            col = mix(col, uZenith, smoothstep(0.25, 0.85, y));
            // horizon glow band, warmer toward the sun
            float band = exp(-abs(y) * 9.0);
            float sun = pow(max(dot(d, uSun), 0.0), 6.0);
            col += uGlow * band * (0.35 + sun * 0.9);
            col += vec3(1.0, 0.72, 0.55) * pow(max(dot(d, uSun), 0.0), 60.0) * 0.6;
            // nebula wisps
            vec2 uv = vec2(atan(d.z, d.x) * 1.6, y * 3.0);
            float neb = fbm(uv * 1.4 + vec2(uTime * 0.003, 0.0));
            neb = smoothstep(0.5, 0.85, neb) * smoothstep(0.0, 0.25, y) * (1.0 - smoothstep(0.6, 0.95, y));
            col += mix(vec3(0.26, 0.2, 0.55), vec3(0.15, 0.45, 0.6), fbm(uv * 3.0)) * neb * 0.45;
            // below the horizon fade to deep fog colour
            col = mix(col, uHorizon * 0.35, smoothstep(0.0, -0.25, y));
            gl_FragColor = vec4(col, 1.0);
          }`,
      }),
    [],
  );

  const starGeo = useMemo(() => {
    const count = QUALITY[quality].stars;
    const r = rng(42);
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const u = r() * 2 - 1;
      const t = r() * Math.PI * 2;
      const y = Math.abs(u) * 0.95 + 0.03; // upper hemisphere
      const s = Math.sqrt(1 - y * y);
      pos.set([Math.cos(t) * s * 6500, y * 6500, Math.sin(t) * s * 6500], i * 3);
      size[i] = 0.6 + Math.pow(r(), 6) * 3.2;
      phase[i] = r() * 100;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('aSize', new Float32BufferAttribute(size, 1));
    g.setAttribute('aPhase', new Float32BufferAttribute(phase, 1));
    return g;
  }, [quality]);

  const starMat = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: { uTime: timeUniform },
        vertexShader: /* glsl */ `
          uniform float uTime; attribute float aSize; attribute float aPhase; varying float vA;
          void main() {
            vA = 0.55 + 0.45 * sin(uTime * (0.8 + fract(aPhase) * 2.0) + aPhase);
            gl_PointSize = aSize * 1.6;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          varying float vA;
          void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d);
            gl_FragColor = vec4(vec3(0.85, 0.92, 1.0) * a * vA, 1.0); }`,
      }),
    [],
  );

  useEffect(() => () => starGeo.dispose(), [starGeo]);

  useFrame(({ camera }) => {
    dome.current?.position.copy(camera.position);
    stars.current?.position.copy(camera.position);
  });

  return (
    <>
      <mesh ref={dome} material={skyMat} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[7000, 48, 24]} />
      </mesh>
      <points ref={stars} geometry={starGeo} material={starMat} renderOrder={-9} frustumCulled={false} />
      <Planet position={[4300, 520, -2600]} radius={900} colorA="#8a3b6b" colorB="#e08a6a" rim="#ffb08a" ring />
      <Planet position={[3600, 900, 2300]} radius={420} colorA="#2b3f8f" colorB="#43CDFF" rim="#9fe4ff" />
      <Planet position={[-3900, 380, 2900]} radius={650} colorA="#4a2a7a" colorB="#8A70E9" rim="#c7b6ff" />
    </>
  );
}

const sphere = new SphereGeometry(1, 64, 48);

function Planet(props: {
  position: [number, number, number];
  radius: number;
  colorA: string;
  colorB: string;
  rim: string;
  ring?: boolean;
}) {
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uA: { value: new Color(props.colorA) },
          uB: { value: new Color(props.colorB) },
          uRim: { value: new Color(props.rim) },
          uSun: { value: SUN_DIR.clone().negate().add(new Vector3(0, 0.4, 0)).normalize() },
        },
        vertexShader: /* glsl */ `
          varying vec3 vN; varying vec3 vP; varying vec3 vV;
          void main() {
            vN = normalize(mat3(modelMatrix) * normal); vP = position;
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vV = normalize(cameraPosition - wp.xyz);
            gl_Position = projectionMatrix * viewMatrix * wp;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uA; uniform vec3 uB; uniform vec3 uRim; uniform vec3 uSun;
          varying vec3 vN; varying vec3 vP; varying vec3 vV;
          void main() {
            float lat = vP.y;
            float bands = sin(lat * 22.0 + sin(vP.x * 4.0) * 1.5) * 0.5 + 0.5;
            bands = mix(bands, sin(lat * 61.0 + vP.z * 3.0) * 0.5 + 0.5, 0.3);
            vec3 base = mix(uA, uB, bands);
            float light = smoothstep(-0.35, 1.0, dot(normalize(vN), normalize(uSun)));
            float rim = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 3.0);
            vec3 col = base * (0.18 + light * 0.85) + uRim * rim * 1.4;
            gl_FragColor = vec4(col, 1.0);
          }`,
      }),
    [props.colorA, props.colorB, props.rim],
  );
  const atmo = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: BackSide,
        uniforms: { uRim: { value: new Color(props.rim) } },
        vertexShader: /* glsl */ `
          varying vec3 vN; varying vec3 vV;
          void main() { vN = normalize(mat3(modelMatrix) * normal);
            vec4 wp = modelMatrix * vec4(position, 1.0); vV = normalize(cameraPosition - wp.xyz);
            gl_Position = projectionMatrix * viewMatrix * wp; }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uRim; varying vec3 vN; varying vec3 vV;
          void main() { float g = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 4.0);
            gl_FragColor = vec4(uRim * g * 0.9, 1.0); }`,
      }),
    [props.rim],
  );
  const ringMat = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        blending: AdditiveBlending,
        uniforms: { uColor: { value: new Color(props.rim) } },
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor; varying vec2 vUv;
          void main(){ float b = sin(vUv.x * 90.0) * 0.5 + 0.5; float c = sin(vUv.x * 23.0) * 0.5 + 0.5;
            gl_FragColor = vec4(uColor * (0.12 + b * 0.18) * c, 1.0); }`,
      }),
    [props.rim],
  );
  const ringGeo = useMemo(() => {
    const g = new RingGeometry(1.35, 2.1, 128, 4);
    // radial uv for banding
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getY(i));
      uv.setXY(i, (r - 1.35) / 0.75, 0);
    }
    return g;
  }, []);
  return (
    <group position={props.position}>
      <mesh geometry={sphere} material={mat} scale={props.radius} />
      <mesh geometry={sphere} material={atmo} scale={props.radius * 1.08} />
      {props.ring && <mesh geometry={ringGeo} material={ringMat} scale={props.radius} rotation={[1.25, 0.2, 0.3]} />}
    </group>
  );
}
