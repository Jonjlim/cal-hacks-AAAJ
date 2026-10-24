import { create } from 'zustand';
import type { QualityLevel } from '../config/quality';
import type { StageId } from '../simulation/promptSimulation';

export type CameraMode = 'EXPLORATION' | 'NETWORK_OVERVIEW' | 'NODE_FOCUS' | 'TRANSITION';

export interface PromptRunState {
  status: 'idle' | 'running' | 'complete';
  stage: StageId | null;
  text: string;
  tokens: string[];
  source: 'simulated' | 'model';
  summary: string;
}

interface GameState {
  started: boolean;
  paused: boolean;
  pointerLocked: boolean;

  cameraMode: CameraMode;
  /** Destination while cameraMode === 'TRANSITION'. */
  transitionTarget: CameraMode | null;
  /** Bumped on every transition request so the camera snapshots its start pose. */
  transitionSeq: number;

  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  /** Path node the player currently stands on (null while on a bridge). */
  currentNodeId: string | null;
  nearestNodeId: string;
  nearbyTerminalId: string | null;
  infoNodeId: string | null;
  promptOpen: boolean;
  visited: string[];

  prompt: PromptRunState;

  quality: QualityLevel;
  terrainStyle: 'wireframe' | 'solid';
  showLabels: boolean;
  settingsOpen: boolean;
  /** performance.now()/1000 when the energy pulse is available again. */
  pulseReadyAt: number;

  start: () => void;
  setPaused: (p: boolean) => void;
  setPointerLocked: (l: boolean) => void;
  requestCamera: (mode: Exclude<CameraMode, 'TRANSITION'>) => void;
  finishTransition: () => void;
  selectNode: (id: string | null) => void;
  hoverNode: (id: string | null) => void;
  setLocation: (current: string | null, nearest: string) => void;
  setNearbyTerminal: (id: string | null) => void;
  openInfo: (id: string | null) => void;
  setPromptOpen: (o: boolean) => void;
  setPrompt: (p: Partial<PromptRunState>) => void;
  setQuality: (q: QualityLevel) => void;
  setTerrainStyle: (s: 'wireframe' | 'solid') => void;
  toggleLabels: () => void;
  setSettingsOpen: (o: boolean) => void;
  setPulseReadyAt: (t: number) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  started: false,
  paused: false,
  pointerLocked: false,
  cameraMode: 'EXPLORATION',
  transitionTarget: null,
  transitionSeq: 0,
  selectedNodeId: null,
  hoveredNodeId: null,
  currentNodeId: null,
  nearestNodeId: 'input-gate',
  nearbyTerminalId: null,
  infoNodeId: null,
  promptOpen: false,
  visited: [],
  prompt: { status: 'idle', stage: null, text: '', tokens: [], source: 'simulated', summary: '' },
  quality: 'medium',
  terrainStyle: 'wireframe',
  showLabels: true,
  settingsOpen: false,
  pulseReadyAt: 0,

  start: () => set({ started: true, paused: false }),
  setPaused: (paused) => set({ paused }),
  setPointerLocked: (pointerLocked) => set({ pointerLocked }),
  requestCamera: (mode) => {
    const s = get();
    const current = s.cameraMode === 'TRANSITION' ? s.transitionTarget : s.cameraMode;
    if (current === mode && mode !== 'NODE_FOCUS') return;
    set({ cameraMode: 'TRANSITION', transitionTarget: mode, transitionSeq: s.transitionSeq + 1 });
  },
  finishTransition: () => {
    const t = get().transitionTarget;
    if (t) set({ cameraMode: t, transitionTarget: null });
  },
  selectNode: (selectedNodeId) => set({ selectedNodeId }),
  hoverNode: (hoveredNodeId) => set({ hoveredNodeId }),
  setLocation: (currentNodeId, nearestNodeId) => {
    const s = get();
    const visited =
      currentNodeId && !s.visited.includes(currentNodeId) ? [...s.visited, currentNodeId] : s.visited;
    set({ currentNodeId, nearestNodeId, visited });
  },
  setNearbyTerminal: (nearbyTerminalId) => set({ nearbyTerminalId }),
  openInfo: (infoNodeId) => set({ infoNodeId }),
  setPromptOpen: (promptOpen) => set({ promptOpen }),
  setPrompt: (p) => set({ prompt: { ...get().prompt, ...p } }),
  setQuality: (quality) => set({ quality }),
  setTerrainStyle: (terrainStyle) => set({ terrainStyle }),
  toggleLabels: () => set({ showLabels: !get().showLabels }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setPulseReadyAt: (pulseReadyAt) => set({ pulseReadyAt }),
}));

/** Effective mode for systems that only care where the camera is heading. */
export function settledMode(): CameraMode {
  const s = useGameStore.getState();
  return s.cameraMode === 'TRANSITION' ? (s.transitionTarget ?? 'EXPLORATION') : s.cameraMode;
}
