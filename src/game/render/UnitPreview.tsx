import { cellToLocal } from '@/game/engine/grid';
import { unitsOfGrade } from '@/game/data/units';
import { UnitVisual } from './visuals/UnitVisual';

/**
 * M1 scaffold: stands a row of real units on the plot so the model pipeline and
 * the placement grid can be seen working. Replaced by the live roster in M3.
 */
export function UnitPreview() {
  const sample = [...unitsOfGrade('normal'), ...unitsOfGrade('magic')].slice(0, 8);

  return (
    <group>
      {sample.map((unit, i) => {
        const cell = cellToLocal(1 + (i % 4) * 2, 3 + Math.floor(i / 4) * 2);
        return (
          <group key={unit.id} position={[cell.x, 0, cell.z]}>
            <UnitVisual unitId={unit.id} grade={unit.grade} />
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
              <ringGeometry args={[0.34, 0.44, 20]} />
              <meshBasicMaterial color="#4aa3ff" transparent opacity={0.75} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
