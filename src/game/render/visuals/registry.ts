import { GENERATED_MODELS, UNIT_MODEL } from './generated';

/**
 * What to draw for a unit.
 *
 * The generated maps come from the source map's own models (see
 * tools/w3x/mdx2glb.mjs). Anything without one — or every unit at all, on a
 * checkout that has not run the pipeline — falls back to a coloured primitive,
 * so the game is always playable and swapping in better art is a data change.
 */

export type Visual =
  | { kind: 'gltf'; asset: string; module: number }
  | { kind: 'placeholder'; shape: 'capsule' | 'box' | 'cone'; color: string };

/** Grade -> placeholder colour, matching the HUD's grade colours. */
export const GRADE_COLOR: Record<string, string> = {
  normal: '#c9d1d9',
  magic: '#4aa3ff',
  rare: '#9d5cff',
  unique: '#ff5cf0',
  legend: '#ff3b3b',
  hidden: '#22e0e0',
  jinchuriki: '#ffd23b',
  bijuu: '#ffe27a',
  elite: '#7bffb0',
  limit: '#ff8a3b',
  epic: '#3bff7a',
  infinity: '#ff7ac2',
  creation: '#ffffff',
  special: '#ffe27a',
  ruin: '#8a2be2',
};

/** Higher grades get a distinct silhouette so they read without a model. */
const PLACEHOLDER_SHAPE: Record<string, 'capsule' | 'box' | 'cone'> = {
  legend: 'cone',
  hidden: 'cone',
  limit: 'box',
  epic: 'box',
  infinity: 'box',
  creation: 'box',
};

export function getVisual(unitId: string, grade: string): Visual {
  const asset = UNIT_MODEL[unitId];
  const module = asset ? GENERATED_MODELS[asset] : undefined;
  if (asset && module !== undefined) return { kind: 'gltf', asset, module };

  return {
    kind: 'placeholder',
    shape: PLACEHOLDER_SHAPE[grade] ?? 'capsule',
    color: GRADE_COLOR[grade] ?? '#c9d1d9',
  };
}

/** True when the asset pipeline has been run against a source map. */
export function hasGeneratedModels(): boolean {
  return Object.keys(GENERATED_MODELS).length > 0;
}
