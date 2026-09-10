import { PLOT_HALF, plotOrigin } from '@/game/config/map';
import { SLOT_COLOR } from './palette';

/**
 * A short coloured post on the corner of an island facing the plaza.
 *
 * It says which seat an island is without any text — the same colour as that
 * island's seam across the plaza and its row in the player panel. When co-op
 * lands this is already the player's identity marker; until then it is how you
 * tell "empty seat" from "scenery".
 *
 * Deliberately not a 3D text label: drei's Text drags troika font loading into
 * the native bundle for something a colour says just as well.
 */
export function SlotPillar({ slot, dim }: { slot: number; dim: boolean }) {
  const origin = plotOrigin(slot);
  // Inside the plot's plaza-facing corner, so it never sits on the lane.
  const x = -Math.sign(origin.x) * (PLOT_HALF - 0.5);
  const z = -Math.sign(origin.z) * (PLOT_HALF - 0.5);
  const color = SLOT_COLOR[slot % SLOT_COLOR.length];
  const height = dim ? 0.9 : 1.4;

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.16, 0.2, height, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={dim ? 0.12 : 0.7}
          transparent
          opacity={dim ? 0.55 : 1}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.3, 0.42, 20]} />
        <meshBasicMaterial color={color} transparent opacity={dim ? 0.2 : 0.6} />
      </mesh>
    </group>
  );
}
