import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      exclude: ['node_modules/', 'src/main.ts', 'src/**/*.module.ts', 'src/**/*.controller.ts', 'dist/']
    }
  }
});
