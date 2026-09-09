import { LANE_CORNER_RADIUS, LANE_HALF } from '@/game/config/map';

/**
 * The closed loop mobs walk. This is the "시작점에서 360도로 도는 구조": mobs
 * spawn at the start gate and circle the plot forever — there is no exit, only
 * the death count.
 *
 * The centreline is a rounded rectangle parameterised by arc length s in [0, L).
 * Mobs leave the start gate heading west and come round the far side:
 *
 *              north
 *          ┌───────◄─────── s=0   arc TR
 *   arc TL │                │
 *          ▼                ▲ east
 *          └───────►────────┘  arc BR
 *              south
 *
 * The shape is built anticlockwise and then walked backwards, so the gate stays
 * where it is and only the travel direction flips.
 */

export interface Vec2 {
  x: number;
  z: number;
}

type Segment =
  | { kind: 'straight'; start: number; length: number; x0: number; z0: number; dx: number; dz: number }
  | { kind: 'arc'; start: number; length: number; cx: number; cz: number; r: number; a0: number };

export interface Lane {
  /** Total centreline length. */
  readonly length: number;
  readonly half: number;
  readonly radius: number;
  /** Arc-length position of the start gate; mobs spawn here. */
  readonly spawnS: number;
  /** Arc-length positions of the two boss gates (mid of the west / east edges). */
  readonly leftBossS: number;
  readonly rightBossS: number;
  /** Flat [x,z,...] polyline of the centreline, for ribbon meshes and the minimap. */
  readonly samples: Float32Array;
  positionAt(s: number, out?: Vec2): Vec2;
  tangentAt(s: number, out?: Vec2): Vec2;
}

export interface LaneConfig {
  half?: number;
  radius?: number;
  sampleCount?: number;
  /** Walk the loop the other way. Defaults to true — mobs head west. */
  reversed?: boolean;
}

/** Positive modulo — JS `%` keeps the sign of the dividend. */
export function wrapS(s: number, length: number): number {
  const m = s % length;
  return m < 0 ? m + length : m;
}

export function createLane(config: LaneConfig = {}): Lane {
  const half = config.half ?? LANE_HALF;
  const r = config.radius ?? LANE_CORNER_RADIUS;
  const sampleCount = config.sampleCount ?? 256;
  const reversed = config.reversed ?? true;

  const straight = 2 * (half - r);
  const arc = (Math.PI / 2) * r;
  const c = half - r; // corner-centre offset from the plot centre

  // Arc points are centre + r*(cos a, sin a); tangent is (-sin a, cos a).
  // Sweeping +PI/2 from a0 walks the loop in the drawing above.
  const segments: Segment[] = [];
  let s = 0;
  const pushStraight = (x0: number, z0: number, dx: number, dz: number) => {
    segments.push({ kind: 'straight', start: s, length: straight, x0, z0, dx, dz });
    s += straight;
  };
  const pushArc = (cx: number, cz: number, a0: number) => {
    segments.push({ kind: 'arc', start: s, length: arc, cx, cz, r, a0 });
    s += arc;
  };

  pushStraight(-c, -half, 1, 0); // north edge, heading east
  pushArc(c, -c, -Math.PI / 2); // TR
  pushStraight(half, -c, 0, 1); // east edge, heading south
  pushArc(c, c, 0); // BR
  pushStraight(c, half, -1, 0); // south edge, heading west
  pushArc(-c, c, Math.PI / 2); // BL
  pushStraight(-half, c, 0, -1); // west edge, heading north
  pushArc(-c, -c, Math.PI); // TL

  const length = s;

  function segmentAt(sw: number): Segment {
    // 8 segments — a linear scan is faster than a binary search here.
    for (let i = segments.length - 1; i >= 0; i--) {
      if (sw >= segments[i].start) return segments[i];
    }
    return segments[0];
  }

  /**
   * Walking backwards along the same curve reverses travel while keeping the
   * gate, the corners and the arc length identical.
   */
  function toBase(sIn: number): number {
    return reversed ? wrapS(-sIn, length) : wrapS(sIn, length);
  }

  function positionAt(sIn: number, out: Vec2 = { x: 0, z: 0 }): Vec2 {
    const sw = toBase(sIn);
    const seg = segmentAt(sw);
    const t = sw - seg.start;
    if (seg.kind === 'straight') {
      out.x = seg.x0 + seg.dx * t;
      out.z = seg.z0 + seg.dz * t;
    } else {
      const a = seg.a0 + t / seg.r;
      out.x = seg.cx + seg.r * Math.cos(a);
      out.z = seg.cz + seg.r * Math.sin(a);
    }
    return out;
  }

  function tangentAt(sIn: number, out: Vec2 = { x: 0, z: 0 }): Vec2 {
    const sw = toBase(sIn);
    const seg = segmentAt(sw);
    if (seg.kind === 'straight') {
      out.x = seg.dx;
      out.z = seg.dz;
    } else {
      const a = seg.a0 + (sw - seg.start) / seg.r;
      out.x = -Math.sin(a);
      out.z = Math.cos(a);
    }
    if (reversed) {
      out.x = -out.x;
      out.z = -out.z;
    }
    return out;
  }

  /** Base arc length -> this lane's parameterisation. */
  function toLaneS(baseS: number): number {
    return reversed ? wrapS(-baseS, length) : wrapS(baseS, length);
  }

  const samples = new Float32Array(sampleCount * 2);
  const tmp: Vec2 = { x: 0, z: 0 };
  for (let i = 0; i < sampleCount; i++) {
    positionAt((i / sampleCount) * length, tmp);
    samples[i * 2] = tmp.x;
    samples[i * 2 + 1] = tmp.z;
  }

  return {
    length,
    half,
    radius: r,
    spawnS: 0,
    // Mid of the west edge / mid of the east edge, mapped into this
    // parameterisation so the gates stay physically put.
    leftBossS: toLaneS(segments[6].start + straight / 2),
    rightBossS: toLaneS(segments[2].start + straight / 2),
    samples,
    positionAt,
    tangentAt,
  };
}

/**
 * Interpolate between two arc-length positions, handling the wrap at s = L.
 * Used to render mobs between fixed sim ticks.
 */
export function lerpWrapped(from: number, to: number, alpha: number, length: number): number {
  const end = to < from ? to + length : to;
  return wrapS(from + (end - from) * alpha, length);
}
