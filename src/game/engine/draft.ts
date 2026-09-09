import { UNITS, type Grade } from '@/game/data/units';
import type { GameState } from './types';
import type { Rng } from './rng';

/**
 * The opening draft.
 *
 * Before the first wave the original hands you a 비급서 — a ranked pick token —
 * and shows a window of random candidates to choose from. You do that a few
 * times, and those picks are the roster you start the defense with.
 *
 * Ranks escalate across the picks, so the draft has an arc: a couple of bodies
 * first, then something that decides how the early rounds actually go.
 */

export const DRAFT_PICKS = 4;
export const DRAFT_OPTIONS = 4;
/** Seconds per pick before one is taken for you. */
export const DRAFT_SECONDS = 20;

export interface DraftRank {
  /** As printed in the original's chat log: "[비급서]_A랭크". */
  nameKo: string;
  grades: Grade[];
}

export const DRAFT_RANKS: DraftRank[] = [
  { nameKo: 'C랭크', grades: ['normal'] },
  { nameKo: 'B랭크', grades: ['normal', 'magic'] },
  { nameKo: 'A랭크', grades: ['rare', 'unique'] },
  { nameKo: 'S랭크', grades: ['legend', 'hidden'] },
];

export interface DraftOption {
  defId: string;
  grade: Grade;
}

export interface DraftPick {
  rankKo: string;
  options: DraftOption[];
}

export interface DraftState {
  active: boolean;
  pickIndex: number;
  picks: DraftPick[];
  chosen: string[];
  timeLeft: number;
}

const POOL_BY_GRADE = new Map<Grade, string[]>();
for (const unit of UNITS) {
  const pool = POOL_BY_GRADE.get(unit.grade) ?? [];
  pool.push(unit.id);
  POOL_BY_GRADE.set(unit.grade, pool);
}

/** Draw distinct candidates from the grades a rank draws on. */
function rollOptions(rng: Rng, rank: DraftRank): DraftOption[] {
  const candidates: DraftOption[] = [];
  for (const grade of rank.grades) {
    for (const defId of POOL_BY_GRADE.get(grade) ?? []) candidates.push({ defId, grade });
  }
  if (!candidates.length) return [];

  const picked: DraftOption[] = [];
  const used = new Set<string>();
  // A rank with a small pool can run out; stop rather than repeat a candidate.
  for (let attempt = 0; picked.length < DRAFT_OPTIONS && attempt < 200; attempt++) {
    const option = candidates[rng.int(candidates.length)];
    if (used.has(option.defId)) continue;
    used.add(option.defId);
    picked.push(option);
  }
  return picked;
}

export function createDraft(rng: Rng): DraftState {
  const picks = DRAFT_RANKS.slice(0, DRAFT_PICKS).map((rank) => ({
    rankKo: rank.nameKo,
    options: rollOptions(rng, rank),
  }));

  return {
    active: true,
    pickIndex: 0,
    picks,
    chosen: [],
    timeLeft: DRAFT_SECONDS,
  };
}

export function currentPick(draft: DraftState): DraftPick | null {
  return draft.active ? (draft.picks[draft.pickIndex] ?? null) : null;
}

/**
 * Take one option. Returns the chosen unit id, or null when the draft is over
 * or the index is out of range.
 */
export function choose(state: GameState, optionIndex: number): string | null {
  const draft = state.draft;
  const pick = currentPick(draft);
  if (!pick) return null;

  const option = pick.options[optionIndex];
  if (!option) return null;

  draft.chosen.push(option.defId);
  draft.pickIndex++;
  draft.timeLeft = DRAFT_SECONDS;
  if (draft.pickIndex >= draft.picks.length) draft.active = false;
  return option.defId;
}

/** Nothing picked in time: take one at random, as the original does. */
export function autoChoose(state: GameState): string | null {
  const pick = currentPick(state.draft);
  if (!pick || !pick.options.length) return null;
  return choose(state, state.rng.int(pick.options.length));
}
