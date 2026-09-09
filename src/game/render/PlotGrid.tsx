import { useMemo } from 'react';
import { BufferAttribute, BufferGeometry } from 'three';

import { CELL_SIZE, PLOT_CELLS, PLOT_HALF } from '@/game/config/map';

/**
 * The placement plot: a slab plus the cell grid units snap to.
 */
export function PlotGrid() {
  const gridGeometry = useMemo(() => buildGrid(), []);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[PLOT_CELLS * CELL_SIZE, PLOT_CELLS * CELL_SIZE]} />
        <meshStandardMaterial color="#3b4a33" roughness={1} />
      </mesh>
      <lineSegments geometry={gridGeometry} position={[0, 0.03, 0]}>
        <lineBasicMaterial color="#5f7350" transparent opacity={0.55} />
      </lineSegments>
    </group>
  );
}

function buildGrid(): BufferGeometry {
  const lines: number[] = [];
  for (let i = 0; i <= PLOT_CELLS; i++) {
    const t = -PLOT_HALF + i * CELL_SIZE;
    lines.push(t, 0, -PLOT_HALF, t, 0, PLOT_HALF);
    lines.push(-PLOT_HALF, 0, t, PLOT_HALF, 0, t);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(lines), 3));
  return geometry;
}
