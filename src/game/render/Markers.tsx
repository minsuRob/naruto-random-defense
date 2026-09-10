import type { Lane } from '@/game/engine/lane';

/**
 * Gates on the loop: where mobs enter, and where the two boss rounds arrive
 * (rounds ending in 0 come from the west gate, rounds ending in 3 from the east).
 */
export function Markers({ lane, dim = false }: { lane: Lane; dim?: boolean }) {
  const spawn = lane.positionAt(lane.spawnS);
  const spawnTangent = lane.tangentAt(lane.spawnS);
  const left = lane.positionAt(lane.leftBossS);
  const right = lane.positionAt(lane.rightBossS);

  return (
    <group>
      <Gate x={spawn.x} z={spawn.z} color="#e8e3d4" height={1.5} dim={dim} />
      {/* Arrow out of the start gate, so the travel direction is unmistakable.
          An idle island has no direction to promise, so it goes without. */}
      {!dim && (
        <mesh
          position={[spawn.x + spawnTangent.x * 1.1, 0.06, spawn.z + spawnTangent.z * 1.1]}
          rotation={[-Math.PI / 2, 0, Math.atan2(-spawnTangent.x, -spawnTangent.z)]}
        >
          <circleGeometry args={[0.42, 3]} />
          <meshBasicMaterial color="#e8e3d4" transparent opacity={0.85} />
        </mesh>
      )}
      <Gate x={left.x} z={left.z} color="#e8862c" height={1.9} dim={dim} />
      <Gate x={right.x} z={right.z} color="#e8862c" height={1.9} dim={dim} />
    </group>
  );
}

function Gate({
  x,
  z,
  color,
  height,
  dim,
}: {
  x: number;
  z: number;
  color: string;
  height: number;
  dim: boolean;
}) {
  return (
    <group position={[x, 0, z]}>
      {/* On an idle island only the ground ring survives: a lit post reads as
          "something comes out of here". */}
      {!dim && (
        <mesh position={[0, height / 2, 0]}>
          <boxGeometry args={[0.24, height, 0.24]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
        </mesh>
      )}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.55, 0.75, 24]} />
        <meshBasicMaterial color={color} transparent opacity={dim ? 0.18 : 0.7} />
      </mesh>
    </group>
  );
}
