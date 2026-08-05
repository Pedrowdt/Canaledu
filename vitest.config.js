import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js', 'tests/**/*.test.{js,mjs}'],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
