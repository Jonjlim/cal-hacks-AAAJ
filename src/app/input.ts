import { Vector3 } from 'three';
import { GRAPH } from '../simulation/graphData';
import { simulatedSource } from '../simulation/promptSimulation';
import { signalController } from '../simulation/signalController';
import { heldKeys, runtime } from '../store/runtime';
import { settledMode, useGameStore } from '../store/useGameStore';

/** Bridges the store to the deterministic signal controller. */
signalController.setStageListener((stage, done) => {
  useGameStore.getState().setPrompt(
    done ? { status: 'complete', stage: null } : { stage, status: 'running' },
  );
});

export async function runPrompt(text: string) {
  const trace = await simulatedSource.createTrace(text);
  signalController.start(trace);
  useGameStore.getState().setPrompt({
    status: 'running',
    stage: 'input',
    text,
    tokens: trace.tokens.map((t) => t.text),
    source: trace.source,
    summary: trace.output.note,
  });
}

export function requestLock() {
  const canvas = document.querySelector('canvas');
  if (!canvas || document.pointerLockElement) return;
  try {
    const r = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
    r?.catch?.(() => {});
  } catch {
    /* pointer lock unavailable (e.g. automation) — mouse-drag look still works */
  }
}

export function releaseLock() {
  if (document.pointerLockElement) document.exitPointerLock();
}

export function respawn() {
  runtime.teleport = runtime.checkpoint.clone();
}

export function travelTo(nodeId: string) {
  const node = GRAPH.nodeById.get(nodeId);
  if (!node) return;
  // Off-path nodes have no deck: land on the walkable node of the same layer.
  const target = node.deck ? node : GRAPH.nodeById.get(GRAPH.path[node.layer])!;
  const p = new Vector3(target.position[0] - 10, target.deck!.top + 1.2, target.position[2]);
  runtime.teleport = p;
  runtime.checkpoint.copy(p);
  runtime.look.yaw = -Math.PI / 2;
  const s = useGameStore.getState();
  s.selectNode(null);
  s.requestCamera('EXPLORATION');
}

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}

export function interact() {
  const s = useGameStore.getState();
  const id = s.nearbyTerminalId;
  if (!id) return;
  const node = GRAPH.nodeById.get(id)!;
  if (node.interaction?.kind === 'prompt') {
    s.setPromptOpen(true);
    releaseLock();
  } else {
    s.openInfo(id);
  }
}

export function toggleOverview() {
  const s = useGameStore.getState();
  if (settledMode() === 'EXPLORATION') {
    s.setPromptOpen(false);
    s.openInfo(null);
    releaseLock();
    s.requestCamera('NETWORK_OVERVIEW');
  } else {
    s.selectNode(null);
    s.requestCamera('EXPLORATION');
    requestLock();
  }
}

/** Installs global keyboard listeners. Returns a disposer. */
export function installInput(): () => void {
  const down = (e: KeyboardEvent) => {
    if (isTyping(e)) {
      if (e.code === 'Escape') (e.target as HTMLElement).blur();
      return;
    }
    const s = useGameStore.getState();
    if (e.code === 'Tab') {
      e.preventDefault();
      if (s.started) toggleOverview();
      return;
    }
    if (!s.started) return;
    heldKeys.add(e.code);
    if (e.repeat) return;
    switch (e.code) {
      case 'KeyE':
        if (settledMode() === 'EXPLORATION') interact();
        break;
      case 'KeyR':
        respawn();
        break;
      case 'KeyP':
        s.setPromptOpen(true);
        releaseLock();
        break;
      case 'Escape':
        if (s.promptOpen) s.setPromptOpen(false);
        else if (s.infoNodeId) s.openInfo(null);
        else if (s.selectedNodeId) s.selectNode(null);
        break;
      case 'Space':
        e.preventDefault();
        break;
    }
  };
  const up = (e: KeyboardEvent) => heldKeys.delete(e.code);
  const blur = () => heldKeys.clear();
  const lockChange = () => {
    const locked = !!document.pointerLockElement;
    const s = useGameStore.getState();
    s.setPointerLocked(locked);
    // Losing lock while exploring with no panel open == Esc pressed -> pause.
    if (!locked && s.started && settledMode() === 'EXPLORATION' && !s.promptOpen && !s.infoNodeId) {
      s.setPaused(true);
    }
    if (locked) s.setPaused(false);
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  document.addEventListener('pointerlockchange', lockChange);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', blur);
    document.removeEventListener('pointerlockchange', lockChange);
  };
}
