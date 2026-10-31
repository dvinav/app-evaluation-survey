import { afterEach, describe, expect, it } from 'vitest'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const directories: string[] = []
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true })
})
describe('standalone asset packaging on clean checkouts', () => {
  it.each([false, true])(
    'packages static assets with public directory present=%s',
    (withPublic) => {
      const root = mkdtempSync(join(tmpdir(), 'survey-standalone-test-'))
      directories.push(root)
      mkdirSync(join(root, '.next/static'), { recursive: true })
      writeFileSync(join(root, '.next/static/synthetic.css'), 'body {}')
      if (withPublic) {
        mkdirSync(join(root, 'public'))
        writeFileSync(join(root, 'public/synthetic.txt'), 'synthetic')
      }
      const result = spawnSync(
        process.execPath,
        [
          fileURLToPath(
            new URL('../../scripts/prepare-standalone.mjs', import.meta.url),
          ),
        ],
        { cwd: root, encoding: 'utf8' },
      )
      expect(result.status, result.stderr).toBe(0)
      expect(existsSync(join(root, '.next/standalone/public'))).toBe(true)
      expect(
        readFileSync(
          join(root, '.next/standalone/.next/static/synthetic.css'),
          'utf8',
        ),
      ).toBe('body {}')
      if (withPublic)
        expect(
          readFileSync(
            join(root, '.next/standalone/public/synthetic.txt'),
            'utf8',
          ),
        ).toBe('synthetic')
    },
  )
})
