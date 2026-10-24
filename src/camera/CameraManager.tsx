import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { PerspectiveCamera, Vector3 } from 'three';
import { GRAPH, nodeVec } from '../simulation/graphData';
import { runtime } from '../store/runtime';
import { settledMode, useGameStore, type CameraMode } from '../store/useGameStore';
import {
  TRANSITION_DURATION,
  applyPose,
  copyPose,
  interpolatePose,
  makePose,
  type CameraPose,
} from './CameraTransitions';

/**
 * The ONLY owner of the camera. Each frame it computes the pose for the
 * active mode (or blends two during TRANSITION) and applies it. Mouse input
 * is routed here too, so no OrbitControls fight the follow camera.
 *
 *  EXPLORATION      third-person orbit around the player (pointer-lock look)
 *  NETWORK_OVERVIEW orbit around the whole network (drag / wheel)
 *  NODE_FOCUS       orbit around the selected node (drag / wheel)
 *  TRANSITION       blend from a snapshot to the live destination pose
 */

const HEAD = 2.3;
const LOOK_SENS = 0.0022;
const DRAG_SENS = 0.005;

export function CameraManager() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const gl = useThree((s) => s.gl);

  const current = useMemo(makePose, []);
  const from = useMemo(makePose, []);
  const dest = useMemo(makePose, []);
  const followTarget = useMemo(() => new Vector3().copy(runtime.player.position).add(new Vector3(0, HEAD, 0)), []);
  const transition = useRef({ seq: -1, elapsed: 0, zoomingOut: true });
  const drag = useRef<{ active: boolean; x: number; y: number; moved: number }>({ active: false, x: 0, y: 0, moved: 0 });

  // ---- input routing -------------------------------------------------------
  useEffect(() => {
    const el = gl.domElement;
    const mode = () => useGameStore.getState().cameraMode;
    const orbit = () => (mode() === 'NODE_FOCUS' ? runtime.focus : runtime.overview);

    const onMove = (e: PointerEvent) => {
      if (document.pointerLockElement === el && mode() === 'EXPLORATION') {
        runtime.look.yaw -= e.movementX * LOOK_SENS;
        runtime.look.pitch = Math.min(1.15, Math.max(-0.3, runtime.look.pitch + e.movementY * LOOK_SENS));
        return;
      }
      const d = drag.current;
      if (!d.active) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      d.x = e.clientX;
      d.y = e.clientY;
      d.moved += Math.abs(dx) + Math.abs(dy);
      if (d.moved > 4) runtime.dragMoved = true;
      if (mode() === 'EXPLORATION') {
        // Fallback mouse-look while pointer lock is unavailable.
        runtime.look.yaw -= dx * DRAG_SENS;
        runtime.look.pitch = Math.min(1.15, Math.max(-0.3, runtime.look.pitch + dy * DRAG_SENS));
      } else if (mode() !== 'TRANSITION') {
        const o = orbit();
        o.yaw -= dx * DRAG_SENS;
        o.pitch = Math.min(1.45, Math.max(0.05, o.pitch + dy * DRAG_SENS));
      }
    };
    const onDown = (e: PointerEvent) => {
      drag.current = { active: true, x: e.clientX, y: e.clientY, moved: 0 };
      runtime.dragMoved = false;
    };
    const onUp = () => {
      drag.current.active = false;
    };
    const onWheel = (e: WheelEvent) => {
      const m = mode();
      const k = Math.exp(e.deltaY * 0.0012);
      if (m === 'EXPLORATION') runtime.look.distance = Math.min(16, Math.max(3.5, runtime.look.distance * k));
      else if (m === 'NETWORK_OVERVIEW') runtime.overview.distance = Math.min(2600, Math.max(260, runtime.overview.distance * k));
      else if (m === 'NODE_FOCUS') runtime.focus.distance = Math.min(400, Math.max(25, runtime.focus.distance * k));
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    el.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      el.removeEventListener('wheel', onWheel);
    };
  }, [gl]);

  // ---- per-mode poses ------------------------------------------------------
  const poseFor = (mode: Exclude<CameraMode, 'TRANSITION'>, out: CameraPose, dt: number) => {
    if (mode === 'EXPLORATION') {
      const p = runtime.player.position;
      // Follow: snappy horizontally, softer vertically (smooths jumps and steps).
      const kx = 1 - Math.exp(-dt * 20);
      const ky = 1 - Math.exp(-dt * 9);
      followTarget.x += (p.x - followTarget.x) * kx;
      followTarget.z += (p.z - followTarget.z) * kx;
      followTarget.y += (p.y + HEAD - followTarget.y) * ky;
      out.target.copy(followTarget);
      out.yaw = runtime.look.yaw;
      out.pitch = runtime.look.pitch;
      out.distance = runtime.look.distance;
      out.fov = 58 + (runtime.player.sprinting ? 6 : 0);
    } else if (mode === 'NETWORK_OVERVIEW') {
      out.target.set(...GRAPH.center);
      out.yaw = runtime.overview.yaw;
      out.pitch = runtime.overview.pitch;
      out.distance = runtime.overview.distance;
      out.fov = 50;
    } else {
      const id = useGameStore.getState().selectedNodeId ?? useGameStore.getState().nearestNodeId;
      nodeVec(id, out.target);
      out.yaw = runtime.focus.yaw;
      out.pitch = runtime.focus.pitch;
      out.distance = runtime.focus.distance;
      out.fov = 50;
    }
    return out;
  };

  useEffect(() => {
    // Initialise straight into the current mode without a blend.
    poseFor(settledMode() as Exclude<CameraMode, 'TRANSITION'>, current, 1);
    applyPose(current, camera);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const s = useGameStore.getState();
    if (s.cameraMode === 'TRANSITION' && s.transitionTarget) {
      const tr = transition.current;
      if (tr.seq !== s.transitionSeq) {
        // New transition: snapshot where we are now.
        tr.seq = s.transitionSeq;
        tr.elapsed = 0;
        copyPose(from, current);
        tr.zoomingOut = s.transitionTarget === 'NETWORK_OVERVIEW';
        if (s.transitionTarget === 'NODE_FOCUS') {
          // Keep the viewing direction: orbit continues from the overview angle.
          runtime.focus.yaw = runtime.overview.yaw;
          runtime.focus.pitch = Math.max(0.2, Math.min(0.6, current.pitch));
          tr.zoomingOut = false;
        }
      }
      tr.elapsed += dt;
      const dur = TRANSITION_DURATION[s.transitionTarget as keyof typeof TRANSITION_DURATION];
      const t = tr.elapsed / dur;
      poseFor(s.transitionTarget as Exclude<CameraMode, 'TRANSITION'>, dest, dt);
      interpolatePose(current, from, dest, t, tr.zoomingOut);
      if (t >= 1) s.finishTransition();
    } else {
      const mode = s.cameraMode as Exclude<CameraMode, 'TRANSITION'>;
      poseFor(mode, dest, dt);
      if (mode === 'EXPLORATION') {
        const fov = current.fov;
        copyPose(current, dest);
        current.fov = fov + (dest.fov - fov) * (1 - Math.exp(-dt * 5));
      }
      else {
        // Ease orbit input so drag and wheel feel weighted.
        const k = 1 - Math.exp(-dt * 8);
        current.target.lerp(dest.target, k);
        let dy = dest.yaw - current.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        current.yaw += dy * k;
        current.pitch += (dest.pitch - current.pitch) * k;
        current.distance = Math.exp(Math.log(current.distance) + (Math.log(dest.distance) - Math.log(current.distance)) * k);
        current.fov += (dest.fov - current.fov) * k;
      }
    }
    applyPose(current, camera);
  });

  return null;
}
