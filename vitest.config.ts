import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@payload-config': fileURLToPath(
        new URL('./src/payload.config.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    env: { PAYLOAD_SECRET: 'unit-test-only-secret-of-at-least-32-characters' },
  },
})
