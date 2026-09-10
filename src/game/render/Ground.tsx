import { mapBounds } from '@/game/config/map';

/**
 * Terrain under everything, sized to the camera bounds.
 *
 * It also catches the clicks that miss: the cell picker only covers the
 * player's own island now, so without this, clicking the plaza or an empty
 * island would leave a selection stuck on.
 */
export function Ground({
  plotCount,
  onClick,
}: {
  plotCount?: number;
  onClick?: () => void;
}) {
  const b = mapBounds(plotCount);
  const width = b.maxX - b.minX;
  const depth = b.maxZ - b.minZ;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[cx, 0, cz]}
      receiveShadow
      onClick={onClick ? () => onClick() : undefined}
    >
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial color="#2c3a26" roughness={1} />
    </mesh>
  );
}
