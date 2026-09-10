'use no memo';

import type { ThreeEvent } from '@react-three/fiber';
import { useState } from 'react';

import { PLOT_CELLS } from '@/game/config/map';
import { cellToLocal, worldToCell, type Cell } from '@/game/engine/grid';

/**
 * Invisible plane over the player's own island that turns pointer positions
 * into cells.
 *
 * Left click issues the move order while in move mode, and clears the selection
 * otherwise. The Warcraft right-click order is raycast in GameScreen instead:
 * React Three Fiber has no contextmenu event, so a mesh handler never fires.
 *
 * The plane lives inside the island's positioned group, but `event.point` is
 * world space regardless — hence the origin.
 */
export function GroundPicker({
  origin,
  onCommand,
  onClearSelection,
  active,
}: {
  origin: { x: number; z: number };
  onCommand: (cell: Cell, point: { x: number; z: number }) => void;
  onClearSelection: () => void;
  active: boolean;
}) {
  const [hover, setHover] = useState<Cell | null>(null);

  const cellAt = (event: ThreeEvent<PointerEvent | MouseEvent>): Cell | null =>
    worldToCell(origin, event.point.x, event.point.z);

  return (
    <>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
        visible={false}
        onPointerMove={(event) => setHover(cellAt(event))}
        onPointerOut={() => setHover(null)}
        onClick={(event) => {
          const cell = cellAt(event);
          if (!cell) return;
          event.stopPropagation();
          if (active) onCommand(cell, { x: event.point.x, z: event.point.z });
          else onClearSelection();
        }}
      >
        <planeGeometry args={[PLOT_CELLS, PLOT_CELLS]} />
      </mesh>

      {hover && active && <HoverCell cell={hover} />}
    </>
  );
}

function HoverCell({ cell }: { cell: Cell }) {
  const local = cellToLocal(cell.cx, cell.cy);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[local.x, 0.045, local.z]}>
      <planeGeometry args={[0.94, 0.94]} />
      <meshBasicMaterial color="#4aa3ff" transparent opacity={0.25} />
    </mesh>
  );
}
