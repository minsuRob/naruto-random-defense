import { Canvas } from '@react-three/fiber/native';
import type { ReactNode } from 'react';

/**
 * Native canvas (expo-gl backed). The import path is explicit even though
 * @react-three/fiber's "react-native" field would resolve it, because the two
 * Canvas components take different props. Kept deliberately close to
 * GameCanvas.web.tsx:
 * only the import path and the sizing style differ. Note `dpr` is Omit-ed from the
 * native CanvasProps — expo-gl sizes the drawing buffer itself, so the mobile
 * perf levers are scene complexity and pixel work, not a DPR clamp.
 *
 * See https://docs.expo.dev/versions/v57.0.0/sdk/gl-view/ — note that three.js cannot
 * run inside a worklet, so the sim stays on the JS thread.
 */
export function GameCanvas({ children }: { children: ReactNode }) {
  return (
    <Canvas
      camera={{ fov: 45, near: 0.1, far: 500, position: [0, 18, 13] }}
      style={{ flex: 1 }}
    >
      {children}
    </Canvas>
  );
}
