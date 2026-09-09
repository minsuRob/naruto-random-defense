import { mapBounds } from '@/game/config/map';

/** Terrain under everything, sized to the camera bounds. */
export function Ground({ plotCount = 1 }: { plotCount?: number }) {
  const b = mapBounds(plotCount);
  const width = b.maxX - b.minX;
  const depth = b.maxZ - b.minZ;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0, cz]} receiveShadow>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial color="#2c3a26" roughness={1} />
    </mesh>
  );
}
