'use no memo';

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';

import { UNIT_BY_ID } from '@/game/data/units';
import type { Engine } from '@/game/engine/engine';
import { GRADE_COLORS } from '@/game/hud/hud-theme';
import { useGameStore } from '@/game/runtime/game-store';
import { UnitVisual } from './visuals/UnitVisual';

/**
 * The player's units.
 *
 * React owns which units exist (the roster snapshot); the engine owns where
 * they are. Positions are copied in useFrame so a unit walking to a new cell
 * actually walks instead of teleporting when the roster changes.
 */

/** Warcraft paints your own selection circles green. */
const SELECTED_RING = '#5fd08a';

export function Units({
  engine,
  onSelect,
}: {
  engine: Engine;
  onSelect: (unitId: number, additive: boolean, sameType: boolean) => void;
}) {
  const units = useGameStore((s) => s.roster.units);
  const selection = useGameStore((s) => s.selection);
  const groups = useRef(new Map<number, Group>());

  useFrame(() => {
    for (const [id, group] of groups.current) {
      const unit = engine.state.units.get(id);
      if (!unit) continue;
      group.position.set(unit.x, 0, unit.z);
      // Face the way it is walking, so a repositioning group reads as moving.
      if (unit.walk) {
        const dx = unit.walk.toX - unit.walk.fromX;
        const dz = unit.walk.toZ - unit.walk.fromZ;
        if (dx !== 0 || dz !== 0) group.rotation.y = Math.atan2(dx, dz);
      }
    }
  });

  return (
    <group>
      {units.map((unit) => {
        const def = UNIT_BY_ID.get(unit.defId);
        const selected = selection.includes(unit.id);
        const color = GRADE_COLORS[def?.grade ?? 'normal'] ?? '#c9d1d9';

        return (
          <group
            key={unit.id}
            ref={(node) => {
              if (node) groups.current.set(unit.id, node);
              else groups.current.delete(unit.id);
            }}
          >
            <UnitVisual unitId={unit.defId} grade={def?.grade ?? 'normal'} />

            {/* Grade ring always, plus the green Warcraft selection circle. */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
              <ringGeometry args={[0.34, 0.44, 20]} />
              <meshBasicMaterial color={color} transparent opacity={selected ? 0.9 : 0.55} />
            </mesh>
            {selected && (
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]}>
                <ringGeometry args={[0.46, 0.56, 28]} />
                <meshBasicMaterial color={SELECTED_RING} transparent opacity={0.95} />
              </mesh>
            )}

            {/* Invisible proxy so a unit is comfortable to click. */}
            <mesh
              position={[0, 0.5, 0]}
              visible={false}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(unit.id, event.shiftKey, event.ctrlKey || event.metaKey);
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
