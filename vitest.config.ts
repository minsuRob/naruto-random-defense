import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Engine + data are pure TypeScript (no React, no three, no react-native),
// so they run in plain node without an Expo/RN preset.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    include: ['src/game/{engine,data}/**/*.test.ts'],
    environment: 'node',
  },
});
