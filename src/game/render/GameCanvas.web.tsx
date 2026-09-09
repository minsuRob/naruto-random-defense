import { Canvas } from '@react-three/fiber';
import type { ReactNode } from 'react';

/**
 * Web canvas. `@react-three/fiber` (DOM) renders into a real <canvas>.
 * The native twin lives in ./GameCanvas.tsx and Metro picks this file for web.
 */
export function GameCanvas({ children }: { children: ReactNode }) {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 45, near: 0.1, far: 500, position: [0, 18, 13] }}
      style={{ position: 'absolute', inset: 0 }}
    >
      {children}
    </Canvas>
  );
}
