import { defineConfig } from 'vitest/config';

// Engine + data are pure TypeScript (no React, no three, no react-native),
// so they run in plain node without an Expo/RN preset.
export default defineConfig({
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
  test: {
    include: ['src/game/**/*.test.ts', 'tools/**/*.test.mts'],
    environment: 'node',
  },
});
