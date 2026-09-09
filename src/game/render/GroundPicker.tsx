'use no memo';

import type { ThreeEvent } from '@react-three/fiber';
import { useState } from 'react';

import { PLOT_CELLS } from '@/game/config/map';
import { cellToLocal, localToCell, type Cell } from '@/game/engine/grid';

/**
 * Invisible plane over the plot that turns pointer positions into cells.
 *
 * Left click issues the move order while in move mode; right click is the
 * Warcraft habit and always moves the selection.
 */
export function GroundPicker({
  onCommand,
  onClearSelection,
  active,
}: {
  onCommand: (cell: Cell) => void;
  onClearSelection: () => void;
  active: boolean;
}) {
  const [hover, setHover] = useState<Cell | null>(null);

  const cellAt = (event: ThreeEvent<PointerEvent | MouseEvent>): Cell | null =>
    localToCell(event.point.x, event.point.z);

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
          if (active) onCommand(cell);
          else onClearSelection();
        }}
        onContextMenu={(event) => {
          const cell = cellAt(event);
          if (cell) {
            event.stopPropagation();
            onCommand(cell);
          }
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
