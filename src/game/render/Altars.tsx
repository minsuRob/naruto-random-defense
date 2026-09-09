import { ALTARS, type AltarKind } from '@/game/config/map';
import { cellToLocal } from '@/game/engine/grid';

/**
 * The four altars in the middle of the plot.
 *
 * Each is a small plinth with a coloured rune ring, so it reads at a glance
 * which one a pakkun is being sent to.
 */

const ALTAR_COLOR: Record<AltarKind, string> = {
  normal: '#c9d1d9',
  magic: '#4aa3ff',
  gold: '#f0c674',
  wood: '#9fd07a',
};

export function Altars({
  onSend,
  highlight,
}: {
  onSend: (kind: AltarKind) => void;
  highlight: boolean;
}) {
  return (
    <group>
      {ALTARS.map((altar) => {
        const local = cellToLocal(altar.cell.cx, altar.cell.cy);
        const color = ALTAR_COLOR[altar.kind];
        return (
          <group key={altar.kind} position={[local.x, 0, local.z]}>
            <mesh position={[0, 0.12, 0]} onClick={() => onSend(altar.kind)}>
              <cylinderGeometry args={[0.34, 0.4, 0.24, 12]} />
              <meshStandardMaterial color="#2b3038" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.28, 0]}>
              <cylinderGeometry args={[0.16, 0.16, 0.1, 10]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={highlight ? 1.1 : 0.4}
              />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.045, 0]}>
              <ringGeometry args={[0.42, 0.5, 24]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={highlight ? 0.95 : 0.45}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
