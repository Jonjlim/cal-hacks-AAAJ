import { PerspectiveCamera, Vector3 } from 'three';

/**
 * Every camera mode is expressed as an orbit pose around a target. That makes
 * transitions a single interpolation: target (lerp), yaw/pitch (shortest arc),
 * distance (logarithmic — the "planet -> solar system -> galaxy" feel).
 */
export interface CameraPose {
  target: Vector3;
  yaw: number;
  pitch: number;
  distance: number;
  fov: number;
}

export function makePose(): CameraPose {
  return { target: new Vector3(), yaw: 0, pitch: 0.3, distance: 10, fov: 55 };
}

export function copyPose(out: CameraPose, src: CameraPose): CameraPose {
  out.target.copy(src.target);
  out.yaw = src.yaw;
  out.pitch = src.pitch;
  out.distance = src.distance;
  out.fov = src.fov;
  return out;
}

export function applyPose(pose: CameraPose, camera: PerspectiveCamera) {
  const cp = Math.cos(pose.pitch);
  camera.position.set(
    pose.target.x + Math.sin(pose.yaw) * cp * pose.distance,
    pose.target.y + Math.sin(pose.pitch) * pose.distance,
    pose.target.z + Math.cos(pose.yaw) * cp * pose.distance,
  );
  camera.lookAt(pose.target);
  if (Math.abs(camera.fov - pose.fov) > 0.01) {
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
  }
}

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

function lerpAngle(a: number, b: number, t: number) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/**
 * Interpolate between poses. `zoomingOut` staggers the curves: when pulling
 * back we first rise away from the player, then swing to the network centre;
 * when diving in we first centre on the destination, then descend.
 */
export function interpolatePose(out: CameraPose, a: CameraPose, b: CameraPose, t: number, zoomingOut: boolean) {
  const e = easeInOutCubic(clamp01(t));
  const eTarget = zoomingOut ? easeInOutCubic(clamp01((t - 0.2) / 0.8)) : easeInOutCubic(clamp01(t / 0.75));
  const eDist = zoomingOut ? easeInOutCubic(clamp01(t / 0.85)) : easeInOutCubic(clamp01((t - 0.1) / 0.9));
  out.target.copy(a.target).lerp(b.target, eTarget);
  out.yaw = lerpAngle(a.yaw, b.yaw, e);
  out.pitch = a.pitch + (b.pitch - a.pitch) * e;
  out.distance = Math.exp(Math.log(a.distance) + (Math.log(b.distance) - Math.log(a.distance)) * eDist);
  // Warp-speed kick: the field of view breathes out mid-flight.
  out.fov = a.fov + (b.fov - a.fov) * e + Math.sin(Math.PI * e) * 12;
  return out;
}

export const TRANSITION_DURATION = {
  NETWORK_OVERVIEW: 2.6,
  EXPLORATION: 2.2,
  NODE_FOCUS: 1.7,
} as const;
