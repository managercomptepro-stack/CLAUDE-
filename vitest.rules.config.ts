import { defineConfig } from 'vitest/config';

/** Security-rules and query tests, against the Firestore emulator (`npm run test:rules`). */
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
