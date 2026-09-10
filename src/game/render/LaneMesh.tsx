import { useMemo } from 'react';
import { BufferAttribute, BufferGeometry, DoubleSide } from 'three';

import { LANE_WIDTH } from '@/game/config/map';
import type { Lane } from '@/game/engine/lane';

/**
 * The lane ribbon: a closed triangle strip built by offsetting the centreline
 * left and right by half the lane width, plus chevrons showing travel direction.
 */
export function LaneMesh({ lane, dim = false }: { lane: Lane; dim?: boolean }) {
  const geometry = useMemo(() => buildRibbon(lane, LANE_WIDTH), [lane]);
  const chevrons = useMemo(() => buildChevrons(lane), [lane]);

  return (
    <group>
      <mesh geometry={geometry} position={[0, 0.02, 0]} receiveShadow>
        <meshStandardMaterial
          color={dim ? '#443c30' : '#6b5b3e'}
          roughness={0.95}
          side={DoubleSide}
        />
      </mesh>
      {/* No direction arrows on a lane nobody walks — they would promise
          movement that never comes. */}
      {!dim &&
        chevrons.map((c, i) => (
          <mesh key={i} position={[c.x, 0.04, c.z]} rotation={[-Math.PI / 2, 0, c.angle]}>
            <planeGeometry args={[0.3, 0.46]} />
            <meshBasicMaterial color="#c9b183" transparent opacity={0.3} />
          </mesh>
        ))}
    </group>
  );
}

function buildRibbon(lane: Lane, width: number): BufferGeometry {
  const count = lane.samples.length / 2;
  const half = width / 2;
  const positions = new Float32Array(count * 2 * 3);
  const indices: number[] = [];

  const p = { x: 0, z: 0 };
  const t = { x: 0, z: 0 };
  for (let i = 0; i < count; i++) {
    const s = (i / count) * lane.length;
    lane.positionAt(s, p);
    lane.tangentAt(s, t);
    // Left-hand normal of a ground-plane tangent.
    const nx = -t.z;
    const nz = t.x;

    const o = i * 6;
    positions[o] = p.x + nx * half;
    positions[o + 1] = 0;
    positions[o + 2] = p.z + nz * half;
    positions[o + 3] = p.x - nx * half;
    positions[o + 4] = 0;
    positions[o + 5] = p.z - nz * half;
  }

  for (let i = 0; i < count; i++) {
    const a = i * 2;
    const b = a + 1;
    const next = ((i + 1) % count) * 2; // wrap closes the loop
    indices.push(a, next, b, b, next, next + 1);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Direction markers. A plane laid flat with rotation [-PI/2, 0, angle] sends its
 * local +Y to world (-sin angle, 0, -cos angle), so pointing it along the
 * tangent means angle = atan2(-tx, -tz).
 */
function buildChevrons(lane: Lane, count = 28) {
  const out: { x: number; z: number; angle: number }[] = [];
  const p = { x: 0, z: 0 };
  const t = { x: 0, z: 0 };
  for (let i = 0; i < count; i++) {
    const s = (i / count) * lane.length;
    lane.positionAt(s, p);
    lane.tangentAt(s, t);
    out.push({ x: p.x, z: p.z, angle: Math.atan2(-t.x, -t.z) });
  }
  return out;
}
