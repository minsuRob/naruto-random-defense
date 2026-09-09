'use no memo';

import { useGameStore } from '@/game/runtime/game-store';
import { cellToLocal } from '@/game/engine/grid';
import { UNIT_BY_ID } from '@/game/data/units';
import { GRADE_COLORS } from '@/game/hud/hud-theme';
import { UnitVisual } from './visuals/UnitVisual';

/**
 * The player's units. Driven by the roster snapshot rather than the engine
 * directly: units only move when the player orders it, so this re-renders on
 * roster changes instead of every frame.
 */
export function Units({ onSelect }: { onSelect: (unitId: number, additive: boolean) => void }) {
  const units = useGameStore((s) => s.roster.units);
  const selection = useGameStore((s) => s.selection);

  return (
    <group>
      {units.map((unit) => {
        const def = UNIT_BY_ID.get(unit.defId);
        const local = cellToLocal(unit.cx, unit.cy);
        const selected = selection.includes(unit.id);
        const color = GRADE_COLORS[def?.grade ?? 'normal'] ?? '#c9d1d9';

        return (
          <group key={unit.id} position={[local.x, 0, local.z]}>
            <UnitVisual unitId={unit.defId} grade={def?.grade ?? 'normal'} />

            {/* Grade ring, and a hit proxy big enough to click comfortably. */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
              <ringGeometry args={[0.34, 0.44, 20]} />
              <meshBasicMaterial color={color} transparent opacity={selected ? 1 : 0.6} />
            </mesh>
            {selected && (
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]}>
                <ringGeometry args={[0.46, 0.54, 24]} />
                <meshBasicMaterial color="#4aa3ff" transparent opacity={0.9} />
              </mesh>
            )}
            <mesh
              position={[0, 0.5, 0]}
              visible={false}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(unit.id, event.shiftKey);
              }}
            >
              <boxGeometry args={[0.9, 1.2, 0.9]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
