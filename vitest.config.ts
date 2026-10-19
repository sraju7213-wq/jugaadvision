import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * Vitest config for the unit-test suite consumed by Stryker.
 *
 * Scope is deliberately limited to `tests/unit/**` (pure logic, no network,
 * no filesystem writes). The legacy hand-rolled runner at
 * services/api/src/ai/__tests__/modelOrchestration.test.ts is intentionally
 * NOT collected: it calls process.exit() at import time and performs live
 * HuggingFace / localhost network calls, which makes mutation runs
 * non-deterministic and very slow.
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@jugaad\/core$/, replacement: r('./packages/core/src/index.ts') },
      { find: /^@jugaad\/core\/(.*)$/, replacement: r('./packages/core/src/$1') },
      { find: /^@jugaad\/api\/(.*)$/, replacement: r('./services/api/src/$1') },
      { find: /^@jugaad\/services\/(.*)$/, replacement: r('./packages/services/src/$1') },
    ],
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup-env.ts'],
    // Mutation testing re-runs these tests hundreds of times; keep them fast
    // and forbid real network access from leaking into the suite.
    testTimeout: 10_000,
    hookTimeout: 10_000,
    reporters: ['default'],
    passWithNoTests: false,
  },
});