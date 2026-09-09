import type { MobDef, MobPool } from './types';

/**
 * Struct-of-arrays mob pool. Slots are recycled through a free list so a long
 * run never allocates, and every field is a typed array so the movement and
 * targeting loops stay cache-friendly.
 */
export function createMobPool(capacity: number): MobPool {
  return {
    capacity,
    count: 0,
    alive: 0,
    active: new Uint8Array(capacity),
    plot: new Uint8Array(capacity),
    defIndex: new Int16Array(capacity),
    s: new Float32Array(capacity),
    sPrev: new Float32Array(capacity),
    x: new Float32Array(capacity),
    z: new Float32Array(capacity),
    hp: new Float32Array(capacity),
    maxHp: new Float32Array(capacity),
    speed: new Float32Array(capacity),
    armor: new Float32Array(capacity),
    stunUntil: new Float32Array(capacity),
    slowUntil: new Float32Array(capacity),
    slowMul: new Float32Array(capacity),
    armorReduce: new Float32Array(capacity),
    armorReduceUntil: new Float32Array(capacity),
    armorReduceStacks: new Uint8Array(capacity),
    isBoss: new Uint8Array(capacity),
    lap: new Uint16Array(capacity),
    freeList: [],
  };
}

/** Returns the new slot index, or -1 when the pool is full. */
export function spawnMob(
  pool: MobPool,
  defIndex: number,
  def: MobDef,
  plot: number,
  s: number
): number {
  let index = pool.freeList.pop();
  if (index === undefined) {
    if (pool.count >= pool.capacity) return -1;
    index = pool.count++;
  }

  pool.active[index] = 1;
  pool.plot[index] = plot;
  pool.defIndex[index] = defIndex;
  pool.s[index] = s;
  pool.sPrev[index] = s;
  pool.hp[index] = def.hp;
  pool.maxHp[index] = def.hp;
  pool.speed[index] = def.speed;
  pool.armor[index] = def.armor;
  pool.stunUntil[index] = 0;
  pool.slowUntil[index] = 0;
  pool.slowMul[index] = 1;
  pool.armorReduce[index] = 0;
  pool.armorReduceUntil[index] = 0;
  pool.armorReduceStacks[index] = 0;
  pool.isBoss[index] = def.isBoss ? 1 : 0;
  pool.lap[index] = 0;
  pool.alive++;
  return index;
}

export function despawnMob(pool: MobPool, index: number): void {
  if (!pool.active[index]) return;
  pool.active[index] = 0;
  pool.alive--;
  pool.freeList.push(index);
}

/** Count of live mobs, recomputed from scratch. Used to assert the counter. */
export function countAlive(pool: MobPool): number {
  let n = 0;
  for (let i = 0; i < pool.count; i++) if (pool.active[i]) n++;
  return n;
}
