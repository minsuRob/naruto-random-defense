import { UNIT_BY_ID } from '@/game/data/units';
import type { Engine } from '@/game/engine/engine';
import { deathCountFor } from '@/game/engine/state';
import type { EngineEvent } from '@/game/engine/types';
import { hudEquals, useGameStore, type HudSnapshot, type RosterEntry } from './game-store';

/**
 * Pushes engine state into the store at a rate the HUD can afford, and turns
 * engine events into log lines.
 */

const PUBLISH_INTERVAL_MS = 100;

export interface HudSync {
  /** Call after a batch of sim ticks. */
  flush(events: EngineEvent[]): void;
}

export function createHudSync(engine: Engine): HudSync {
  let lastPublish = 0;
  let lastHud: HudSnapshot | null = null;
  let lastRosterVersion = -1;

  function snapshot(): HudSnapshot {
    const { state } = engine;
    const round = state.round;
    const limit = round.hardLimit ?? round.duration;
    const player = state.players[0];
    return {
      round: round.number,
      phase: round.phase,
      timeLeft: Math.max(0, Math.ceil(limit - round.elapsed)),
      aliveOnLane: state.aliveOnLane[0] ?? 0,
      deathCount: deathCountFor(state, round.number),
      gold: player?.gold ?? 0,
      wood: player?.wood ?? 0,
      pakkun: player?.pakkun ?? 0,
      over: state.over,
      outcome: state.outcome,
    };
  }

  function publishRoster() {
    const { state } = engine;
    if (state.rosterVersion === lastRosterVersion) return;
    lastRosterVersion = state.rosterVersion;

    const units: RosterEntry[] = [];
    const countsByDef: Record<string, number> = {};
    for (const unit of state.units.values()) {
      units.push({ id: unit.id, defId: unit.defId, cx: unit.cell.cx, cy: unit.cell.cy });
      countsByDef[unit.defId] = (countsByDef[unit.defId] ?? 0) + 1;
    }
    useGameStore.getState().setRoster({ version: state.rosterVersion, units, countsByDef });
  }

  function describe(event: EngineEvent): string | null {
    switch (event.e) {
      case 'roundStart':
        return `${event.round}라운드 시작`;
      case 'gameOver':
        return event.outcome === 'win' ? '클리어!' : '패배';
      case 'mission':
        return `${event.rank}랭크 임무 성공 — 목재 +${event.wood}`;
      case 'unitAdd': {
        const def = UNIT_BY_ID.get(event.defId);
        return def ? `${def.nameKo} 획득` : null;
      }
      case 'log':
        return event.text;
      default:
        return null;
    }
  }

  return {
    flush(events) {
      const store = useGameStore.getState();

      for (const event of events) {
        const text = describe(event);
        if (text) store.pushLog(text);
      }

      const now = Date.now();
      const forced = engine.state.over;
      if (!forced && now - lastPublish < PUBLISH_INTERVAL_MS) return;
      lastPublish = now;

      const hud = snapshot();
      if (!lastHud || !hudEquals(lastHud, hud)) {
        lastHud = hud;
        store.setHud(hud);
      }
      publishRoster();
    },
  };
}
