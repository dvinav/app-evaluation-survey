import 'dotenv/config'
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
const database = process.env.TEST_DATABASE_URL
if (!database || !new URL(database).pathname.endsWith('_test'))
  throw new Error(
    'TEST_DATABASE_URL must point to a disposable database ending in _test',
  )
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
    include: ['tests/integration/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
    env: {
      DATABASE_URL: database,
      PAYLOAD_SECRET: 'integration-only-secret-of-at-least-32-characters',
      ALLOW_DEMO_SEED: 'true',
      MEDIA_DIR: '/tmp/app-evaluation-survey-test-media',
    },
  },
})
