import { useMemo } from 'react';
import { BufferAttribute, BufferGeometry } from 'three';

import { PLAZA_HALF, PLAZA_PEDESTAL_RADIUS, PLOT_COUNT, plotOrigin } from '@/game/config/map';
import { SLOT_COLOR } from './palette';

/**
 * The shared plaza at the centre of the map.
 *
 * This is where a run actually starts: your pakkun wait on the pedestal and you
 * send them off to one of the four altars around it. Stone rather than grass on
 * purpose — nothing can be built here, and it should not look like it invites a
 * unit.
 *
 * The four seams running out to the corners divide the pedestal into one
 * quadrant per island, so a queue of tokens visibly belongs to the base it
 * points at.
 */
export function Plaza() {
  const seams = useMemo(buildSeams, []);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} receiveShadow>
        <planeGeometry args={[PLAZA_HALF * 2, PLAZA_HALF * 2]} />
        <meshStandardMaterial color="#3a3d44" roughness={0.95} />
      </mesh>

      {/* Edge, so the plaza reads as its own place rather than worn grass. */}
      <lineSegments geometry={seams.border} position={[0, 0.035, 0]}>
        <lineBasicMaterial color="#5b606b" transparent opacity={0.7} />
      </lineSegments>

      {seams.lines.map((line, i) => (
        <lineSegments key={i} geometry={line} position={[0, 0.03, 0]}>
          <lineBasicMaterial color={SLOT_COLOR[i]} transparent opacity={0.28} />
        </lineSegments>
      ))}

      <mesh position={[0, 0.05, 0]} receiveShadow>
        <cylinderGeometry args={[PLAZA_PEDESTAL_RADIUS, PLAZA_PEDESTAL_RADIUS + 0.15, 0.1, 32]} />
        <meshStandardMaterial color="#4a4e57" roughness={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.105, 0]}>
        <ringGeometry args={[PLAZA_PEDESTAL_RADIUS - 0.18, PLAZA_PEDESTAL_RADIUS, 40]} />
        <meshBasicMaterial color="#8a909c" transparent opacity={0.45} />
      </mesh>
    </group>
  );
}

function buildSeams() {
  const border = segments([
    [-PLAZA_HALF, -PLAZA_HALF, PLAZA_HALF, -PLAZA_HALF],
    [PLAZA_HALF, -PLAZA_HALF, PLAZA_HALF, PLAZA_HALF],
    [PLAZA_HALF, PLAZA_HALF, -PLAZA_HALF, PLAZA_HALF],
    [-PLAZA_HALF, PLAZA_HALF, -PLAZA_HALF, -PLAZA_HALF],
  ]);

  // One seam per island, pointing at it from the pedestal edge.
  const lines = Array.from({ length: PLOT_COUNT }, (_, i) => {
    const origin = plotOrigin(i);
    const dx = Math.sign(origin.x) * Math.SQRT1_2;
    const dz = Math.sign(origin.z) * Math.SQRT1_2;
    const from = PLAZA_PEDESTAL_RADIUS;
    const to = PLAZA_HALF * Math.SQRT2;
    return segments([[dx * from, dz * from, dx * to, dz * to]]);
  });

  return { border, lines };
}

function segments(pairs: [number, number, number, number][]): BufferGeometry {
  const points: number[] = [];
  for (const [x0, z0, x1, z1] of pairs) points.push(x0, 0, z0, x1, 0, z1);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(points), 3));
  return geometry;
}
