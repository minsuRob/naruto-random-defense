import { create } from 'zustand';

import { DEFAULT_INPUT_SETTINGS, type InputSettings } from '@/game/input/types';

/**
 * The React-visible slice of the game.
 *
 * Rule of thumb for what belongs here: anything a component renders as text or
 * a list. Everything that changes every tick — mob positions, HP, the camera —
 * is read straight off the engine in useFrame, because putting it here would
 * re-render the HUD 20 times a second for nothing.
 */

export interface HudSnapshot {
  round: number;
  phase: 'prep' | 'wave' | 'ended';
  /** Seconds left in the setup window before round 1. */
  prepLeft: number;
  /** Whole seconds, so the top bar only re-renders once a second. */
  timeLeft: number;
  aliveOnLane: number;
  deathCount: number;
  gold: number;
  wood: number;
  pakkun: number;
  over: boolean;
  outcome: 'win' | 'lose' | null;
}

export interface RosterEntry {
  id: number;
  defId: string;
  cx: number;
  cy: number;
}

export interface LogLine {
  id: number;
  text: string;
}

export type UiMode = 'idle' | 'move' | 'gamble';

export interface GameStore {
  hud: HudSnapshot;
  roster: { version: number; units: RosterEntry[]; countsByDef: Record<string, number> };
  selection: number[];
  controlGroups: number[][];
  uiMode: UiMode;
  comboBook: { open: boolean; category: string | null; filterUnitId: string | null };
  log: LogLine[];
  paused: boolean;
  settings: InputSettings;

  setHud(hud: HudSnapshot): void;
  setRoster(roster: GameStore['roster']): void;
  setSelection(ids: number[]): void;
  setUiMode(mode: UiMode): void;
  setComboBook(patch: Partial<GameStore['comboBook']>): void;
  pushLog(text: string): void;
  setPaused(paused: boolean): void;
  setSettings(patch: Partial<InputSettings>): void;
  reset(): void;
}

const EMPTY_HUD: HudSnapshot = {
  round: 0,
  phase: 'prep',
  prepLeft: 0,
  timeLeft: 0,
  aliveOnLane: 0,
  deathCount: 0,
  gold: 0,
  wood: 0,
  pakkun: 0,
  over: false,
  outcome: null,
};

const MAX_LOG = 50;
let logId = 0;

export const useGameStore = create<GameStore>((set) => ({
  hud: EMPTY_HUD,
  roster: { version: -1, units: [], countsByDef: {} },
  selection: [],
  controlGroups: Array.from({ length: 10 }, () => []),
  uiMode: 'idle',
  comboBook: { open: false, category: null, filterUnitId: null },
  log: [],
  paused: false,
  settings: { ...DEFAULT_INPUT_SETTINGS },

  setHud: (hud) => set({ hud }),
  setRoster: (roster) => set({ roster }),
  setSelection: (selection) => set({ selection }),
  setUiMode: (uiMode) => set({ uiMode }),
  setComboBook: (patch) => set((s) => ({ comboBook: { ...s.comboBook, ...patch } })),
  pushLog: (text) =>
    set((s) => ({ log: [...s.log, { id: ++logId, text }].slice(-MAX_LOG) })),
  setPaused: (paused) => set({ paused }),
  setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
  reset: () =>
    set({
      hud: EMPTY_HUD,
      roster: { version: -1, units: [], countsByDef: {} },
      selection: [],
      controlGroups: Array.from({ length: 10 }, () => []),
      uiMode: 'idle',
      comboBook: { open: false, category: null, filterUnitId: null },
      log: [],
      paused: false,
    }),
}));

/** Shallow compare, so an unchanged HUD never triggers a re-render. */
export function hudEquals(a: HudSnapshot, b: HudSnapshot): boolean {
  return (
    a.round === b.round &&
    a.phase === b.phase &&
    a.prepLeft === b.prepLeft &&
    a.timeLeft === b.timeLeft &&
    a.aliveOnLane === b.aliveOnLane &&
    a.deathCount === b.deathCount &&
    a.gold === b.gold &&
    a.wood === b.wood &&
    a.pakkun === b.pakkun &&
    a.over === b.over &&
    a.outcome === b.outcome
  );
}
