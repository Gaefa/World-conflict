import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Pure logic only — no DOM needed. Component tests would add jsdom here.
    environment: 'node',
    include: ['packages/*/test/**/*.test.ts', 'apps/*/test/**/*.test.ts'],
  },
});
