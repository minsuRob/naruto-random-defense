import raw from './generated/recipes.raw.json';
import { UNIT_BY_ID, type Grade } from './units';

/**
 * Combination recipes, recovered from the source map (tools/w3x/recipes.mjs).
 *
 * The map does not state a wood cost per recipe — the 조합식존 only prints the
 * material list — so cost is derived from the result's grade, matching the
 * original's 5-10 목재 range.
 */

export interface RecipeMaterial {
  unitId: string;
  nameKo: string;
  grade: Grade;
  count: number;
}

export interface Recipe {
  id: string;
  resultId: string;
  resultNameKo: string;
  category: Grade;
  materials: RecipeMaterial[];
  wood: number;
}

const WOOD_BY_GRADE: Partial<Record<Grade, number>> = {
  normal: 1,
  magic: 2,
  rare: 3,
  unique: 4,
  legend: 5,
  hidden: 5,
  jinchuriki: 5,
  bijuu: 6,
  elite: 7,
  limit: 10,
  epic: 8,
  infinity: 10,
  creation: 10,
  special: 6,
  ruin: 10,
};

export const RECIPES: Recipe[] = (raw.recipes as Omit<Recipe, 'wood'>[])
  // Drop anything whose result or materials fell out of the unit table.
  .filter((r) => UNIT_BY_ID.has(r.resultId) && r.materials.every((m) => UNIT_BY_ID.has(m.unitId)))
  .map((r) => ({ ...r, wood: WOOD_BY_GRADE[r.category] ?? 5 }));

export const RECIPE_BY_ID = new Map<string, Recipe>(RECIPES.map((r) => [r.id, r]));

/** Recipes that produce a given unit. */
export const RECIPES_BY_RESULT = new Map<string, Recipe[]>();
/** Recipes that consume a given unit — "what can I build with this?". */
export const RECIPES_BY_MATERIAL = new Map<string, Recipe[]>();

for (const recipe of RECIPES) {
  const byResult = RECIPES_BY_RESULT.get(recipe.resultId) ?? [];
  byResult.push(recipe);
  RECIPES_BY_RESULT.set(recipe.resultId, byResult);

  for (const material of recipe.materials) {
    const byMaterial = RECIPES_BY_MATERIAL.get(material.unitId) ?? [];
    if (!byMaterial.includes(recipe)) byMaterial.push(recipe);
    RECIPES_BY_MATERIAL.set(material.unitId, byMaterial);
  }
}

/** Recipe categories in the order the combo book shows them. */
export const RECIPE_CATEGORIES: Grade[] = [
  'hidden',
  'jinchuriki',
  'bijuu',
  'limit',
  'special',
  'legend',
  'epic',
  'elite',
  'infinity',
  'creation',
  'ruin',
  'unique',
  'rare',
  'magic',
  'normal',
].filter((g) => RECIPES.some((r) => r.category === g)) as Grade[];
