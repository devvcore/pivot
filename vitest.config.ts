import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 15000,
    // Isolate test files to prevent cross-contamination
    isolate: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
});
