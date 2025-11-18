import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'c8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/**/*.ts', 'api/**/*.ts'],
      exclude: ['lib/types.ts', '**/*.d.ts']
    }
  }
})
