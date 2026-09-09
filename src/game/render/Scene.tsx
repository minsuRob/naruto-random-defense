/**
 * Scene graph root. M0 is a placeholder: lights + a box so we can prove the
 * canvas, the route and the bundler pipeline all work before the game exists.
 */
export function Scene() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[8, 14, 6]} intensity={1.6} castShadow />
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#e8a33d" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#2f4a2b" />
      </mesh>
    </>
  );
}
