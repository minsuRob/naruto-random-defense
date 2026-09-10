/**
 * World layout constants.
 *
 * One world unit = one placement cell. Four defense islands sit on the
 * diagonals around a shared plaza at the world origin; the plaza holds the four
 * altars and the pakkun tokens, as in the original.
 *
 * Cells are expressed in plot-local coordinates — world position = local +
 * plot.origin. The plaza is the exception: it belongs to nobody, so its
 * contents are world positions outright.
 *
 * Axes: +x right, +z toward the viewer ("south"), -z away ("north").
 */

/** Placement plot is PLOT_CELLS x PLOT_CELLS cells, centred on the plot origin. */
export const PLOT_CELLS = 10;
export const CELL_SIZE = 1;
/** Half-extent of the plot in world units: cells span [-PLOT_HALF, +PLOT_HALF]. */
export const PLOT_HALF = (PLOT_CELLS * CELL_SIZE) / 2;

/** Lane centreline: rounded rectangle with this half-extent and corner radius. */
export const LANE_HALF = 7;
export const LANE_CORNER_RADIUS = 2.5;
/** Visual width of the lane ribbon (mobs walk down the middle). */
export const LANE_WIDTH = 1.2;

/** Outer edge of one island: the plot, its lane, and the lane's own width. */
export const ISLAND_HALF = LANE_HALF + LANE_WIDTH / 2;

/** Padding between the outermost island edge and the camera bounds. */
export const MAP_MARGIN = 4;

/** Four islands, one per player. v1 gives an owner to index 0 only. */
export const PLOT_COUNT = 4;
/** Distance from the world origin to a plot centre, per axis. */
export const PLOT_OFFSET = 14;
/** Centre-to-centre spacing between neighbouring islands. */
export const PLOT_PITCH = PLOT_OFFSET * 2;

/**
 * Quadrant signs in plot-id order. Plot 0 is the local player's.
 *
 * Index 0 is the south-west quadrant deliberately: at a 55° pitch the ground
 * runs much further away from the camera than toward it, so a base in the south
 * with the plaza to its north-east fits one framing. From the north-west the
 * same framing pushes the plaza off the bottom of the screen.
 */
const PLOT_SIGNS: readonly (readonly [number, number])[] = [
  [-1, 1], // 0 south-west — the local player
  [1, 1], // 1 south-east
  [-1, -1], // 2 north-west
  [1, -1], // 3 north-east
];

export function plotOrigin(index: number): { x: number; z: number } {
  const [sx, sz] = PLOT_SIGNS[index % PLOT_COUNT];
  return { x: sx * PLOT_OFFSET, z: sz * PLOT_OFFSET };
}

/** Axis-aligned world bounds covering the islands plus margin. */
export function mapBounds(plotCount: number = PLOT_COUNT) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < plotCount; i++) {
    const o = plotOrigin(i);
    minX = Math.min(minX, o.x - ISLAND_HALF - MAP_MARGIN);
    maxX = Math.max(maxX, o.x + ISLAND_HALF + MAP_MARGIN);
    minZ = Math.min(minZ, o.z - ISLAND_HALF - MAP_MARGIN);
    maxZ = Math.max(maxZ, o.z + ISLAND_HALF + MAP_MARGIN);
  }
  return { minX, maxX, minZ, maxZ };
}

/** The shared plaza between the four islands. Half-extent in world units. */
export const PLAZA_HALF = 6;
/** The pedestal the pakkun tokens stand on, at the plaza centre. */
export const PLAZA_PEDESTAL_RADIUS = 2.4;

/**
 * The four altars, arranged as a diamond on the axes around the plaza centre.
 *
 * This is where a pakkun token has to be walked to, as in the original: the
 * token is the widget you are handed, and what you get depends on which
 * direction you send it. The islands take the diagonals, so the altars take the
 * axes — the two sets never read as the same thing, and "one of four
 * directions" is literally true.
 */
export type AltarKind = 'normal' | 'magic' | 'gold' | 'wood';

/** How far each altar sits from the plaza centre. */
export const ALTAR_RADIUS = 5;

export interface AltarDef {
  kind: AltarKind;
  nameKo: string;
  hint: string;
  /** Which way the token trots off, for the command card. */
  arrow: string;
  /** World position in the shared plaza — every player sends to these four. */
  pos: { x: number; z: number };
}

export const ALTARS: AltarDef[] = [
  {
    kind: 'magic',
    nameKo: '위쪽 제단',
    hint: '노말 + 매직',
    arrow: '↑',
    pos: { x: 0, z: -ALTAR_RADIUS },
  },
  { kind: 'gold', nameKo: '금고', hint: '골드 100', arrow: '→', pos: { x: ALTAR_RADIUS, z: 0 } },
  {
    kind: 'normal',
    nameKo: '아래쪽 제단',
    hint: '노말',
    arrow: '↓',
    pos: { x: 0, z: ALTAR_RADIUS },
  },
  { kind: 'wood', nameKo: '목재소', hint: '목재 60%', arrow: '←', pos: { x: -ALTAR_RADIUS, z: 0 } },
];

export const ALTAR_BY_KIND: Record<AltarKind, AltarDef> = Object.fromEntries(
  ALTARS.map((a) => [a.kind, a])
) as Record<AltarKind, AltarDef>;

/**
 * Where the front row of idle tokens stands, measured along the diagonal.
 *
 * Tight enough that three rows — a dozen tokens, more than a round ever hands
 * out — still stand on the pedestal rather than spilling onto the plaza floor.
 */
export const PAKKUN_PAD_RADIUS = 1.2;
export const PAKKUN_HOLDING_SPACING = 0.5;
/** Tokens per row before the queue grows outward toward its own island. */
export const PAKKUN_ROW = 4;

/**
 * Where an idle pakkun token waits: on the plaza pedestal, in the quadrant
 * facing its own island, growing outward along that diagonal.
 *
 * Each player gets their own quadrant, so queues never collide, and the altars
 * are on the axes, so a queue never crosses one.
 */
export function pakkunHoldingSpot(plotIndex: number, slot: number): { x: number; z: number } {
  const [sx, sz] = PLOT_SIGNS[plotIndex % PLOT_COUNT];
  // Unit vector toward that island, and the one across the queue.
  const dx = sx * Math.SQRT1_2;
  const dz = sz * Math.SQRT1_2;
  const px = -dz;
  const pz = dx;

  const row = Math.floor(slot / PAKKUN_ROW);
  const column = (slot % PAKKUN_ROW) - (PAKKUN_ROW - 1) / 2;
  const out = PAKKUN_PAD_RADIUS + row * PAKKUN_HOLDING_SPACING;

  return {
    x: dx * out + px * column * PAKKUN_HOLDING_SPACING,
    z: dz * out + pz * column * PAKKUN_HOLDING_SPACING,
  };
}
