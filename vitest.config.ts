import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/test/**'],
      thresholds: {
        statements: 40,
        branches: 35,
        functions: 45,
        lines: 40,
      },
    },
  },
});
