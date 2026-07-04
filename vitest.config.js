import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'], // Onde seus testes vão ficar
  },
});import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',           // não usamos jsdom, usamos stubs manuais
    include: ['tests/unit/**/*.test.mjs'],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
