import type { Engine } from '@/game/engine/engine';
import { availability, countsFor } from '@/game/engine/combine';
import { RECIPES_BY_MATERIAL } from '@/game/data/recipes';
import type { Hotkey } from '@/game/input/types';
import { useGameStore } from './game-store';

/**
 * Translates command-card hotkeys into engine commands and UI mode changes.
 *
 * The player is always player 0 in v1; the engine already indexes by player so
 * co-op only has to pass a different id.
 */
export const LOCAL_PLAYER = 0;

export function handleHotkey(engine: Engine, key: Hotkey): void {
  const store = useGameStore.getState();

  switch (key) {
    case 'PAKKUN_DOWN':
      engine.enqueue({ t: 'PAKKUN_DOWN', player: LOCAL_PLAYER });
      break;
    case 'PAKKUN_UP':
      engine.enqueue({ t: 'PAKKUN_UP', player: LOCAL_PLAYER });
      break;
    case 'PAKKUN_GOLD':
      engine.enqueue({ t: 'PAKKUN_GOLD', player: LOCAL_PLAYER });
      break;
    case 'PAKKUN_WOOD':
      engine.enqueue({ t: 'PAKKUN_WOOD', player: LOCAL_PLAYER });
      break;

    case 'GAMBLE':
      store.setUiMode(store.uiMode === 'gamble' ? 'idle' : 'gamble');
      break;
    case 'GAMBLE_1':
      engine.enqueue({ t: 'GAMBLE', player: LOCAL_PLAYER, tier: 1 });
      store.setUiMode('idle');
      break;
    case 'GAMBLE_3':
      engine.enqueue({ t: 'GAMBLE', player: LOCAL_PLAYER, tier: 3 });
      store.setUiMode('idle');
      break;
    case 'GAMBLE_5':
      engine.enqueue({ t: 'GAMBLE', player: LOCAL_PLAYER, tier: 5 });
      store.setUiMode('idle');
      break;

    case 'HIRE_NORMAL':
      engine.enqueue({ t: 'HIRE', player: LOCAL_PLAYER, grade: 'normal' });
      break;
    case 'HIRE_MAGIC':
      engine.enqueue({ t: 'HIRE', player: LOCAL_PLAYER, grade: 'magic' });
      break;

    case 'SELL':
      if (store.selection.length) {
        engine.enqueue({ t: 'SELL', player: LOCAL_PLAYER, unitIds: store.selection });
        store.setSelection([]);
      }
      break;

    case 'MOVE':
      if (store.selection.length) store.setUiMode(store.uiMode === 'move' ? 'idle' : 'move');
      break;

    case 'COMBINE':
      openCombineFor(engine);
      break;

    case 'COMBO_BOOK':
      store.setComboBook({ open: !store.comboBook.open, filterUnitId: null });
      break;

    case 'CANCEL':
      if (store.comboBook.open) store.setComboBook({ open: false });
      else if (store.uiMode !== 'idle') store.setUiMode('idle');
      else store.setSelection([]);
      break;

    default:
      break;
  }
}

/**
 * `C` with a selection: if exactly one recipe using the selected unit is
 * completable, run it; otherwise open the book filtered to that unit.
 */
function openCombineFor(engine: Engine): void {
  const store = useGameStore.getState();
  const selected = store.selection[0];
  if (selected === undefined) {
    store.setComboBook({ open: true, filterUnitId: null });
    return;
  }

  const unit = engine.state.units.get(selected);
  if (!unit) return;

  const candidates = RECIPES_BY_MATERIAL.get(unit.defId) ?? [];
  const counts = countsFor(engine.state, LOCAL_PLAYER);
  const wood = engine.state.players[LOCAL_PLAYER]?.wood ?? 0;
  const ready = candidates.filter((r) => availability(r, counts, wood).ok);

  if (ready.length === 1) {
    engine.enqueue({
      t: 'COMBINE',
      player: LOCAL_PLAYER,
      recipeId: ready[0].id,
      preferIds: store.selection,
    });
    store.setSelection([]);
    return;
  }
  store.setComboBook({ open: true, filterUnitId: unit.defId });
}
