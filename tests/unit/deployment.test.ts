import { afterEach, describe, expect, it } from 'vitest'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
const directories: string[] = []
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true })
})
function deploy(failure = '', bootstrap = false, tag = 'sha-123abcd') {
  const directory = mkdtempSync(join(tmpdir(), 'survey-deployment-test-'))
  directories.push(directory)
  mkdirSync(join(directory, 'bin'))
  mkdirSync(join(directory, '.registry'))
  writeFileSync(join(directory, '.registry/config.json'), '{}')
  writeFileSync(
    join(directory, '.env'),
    `APP_IMAGE=ghcr.io/synthetic/survey\nAPP_VERSION=${bootstrap ? 'uninitialized' : 'sha-7654321'}\n`,
  )
  writeFileSync(join(directory, 'compose.yml'), 'services: {}\n')
  const docker = `#!/bin/sh
printf '%s\\n' "$*" >> "$DEPLOY_TEST_LOG"
case "$*" in
  'compose -f compose.yml ps -q web') if [ "$DEPLOY_TEST_BOOTSTRAP" != true ]; then echo synthetic-container; fi ;;
  'compose -f compose.yml pull web migrate') if [ "$DEPLOY_TEST_FAILURE" = pull ]; then exit 9; fi ;;
  'compose -f compose.yml run -T --rm --no-deps migrate') if [ "$DEPLOY_TEST_FAILURE" = migration ]; then exit 9; fi ;;
  'compose -f compose.yml up -d --no-deps --wait --wait-timeout 180 web') if [ "$DEPLOY_TEST_FAILURE" = health ] && grep -q 'APP_VERSION=sha-123abcd' .env; then exit 9; fi ;;
esac
exit 0
`
  writeFileSync(join(directory, 'bin/docker'), docker, { mode: 0o755 })
  writeFileSync(join(directory, 'bin/flock'), '#!/bin/sh\nexit 0\n', {
    mode: 0o755,
  })
  if (process.platform === 'darwin')
    writeFileSync(
      join(directory, 'bin/sed'),
      '#!/bin/sh\nif [ "$1" = -i ]; then shift; exec /usr/bin/sed -i "" "$@"; fi\nexec /usr/bin/sed "$@"\n',
      { mode: 0o755 },
    )
  const result = spawnSync(
    'sh',
    [
      fileURLToPath(
        new URL('../../scripts/deploy-production.sh', import.meta.url),
      ),
      tag,
    ],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${join(directory, 'bin')}:${process.env.PATH}`,
        SURVEY_DEPLOY_DIR: directory,
        DEPLOY_TEST_LOG: join(directory, 'calls'),
        DEPLOY_TEST_FAILURE: failure,
        DEPLOY_TEST_BOOTSTRAP: String(bootstrap),
      },
    },
  )
  return {
    result,
    environment: readFileSync(join(directory, '.env'), 'utf8'),
    calls: existsSync(join(directory, 'calls'))
      ? readFileSync(join(directory, 'calls'), 'utf8')
      : '',
    registryExists: existsSync(join(directory, '.registry')),
  }
}
describe('production deployment orchestration without real Docker access', () => {
  it('pulls paired immutable images, migrates before restarting, and removes ephemeral registry credentials', () => {
    const { result, environment, calls, registryExists } = deploy()
    expect(result.status, result.stderr).toBe(0)
    expect(environment).toContain('APP_VERSION=sha-123abcd')
    expect(calls).toContain('pull web migrate')
    expect(calls.indexOf('run -T --rm --no-deps migrate')).toBeLessThan(
      calls.indexOf('up -d --no-deps --wait'),
    )
    expect(registryExists).toBe(false)
  })
  it.each(['pull', 'migration', 'health'])(
    'restores the previous image configuration when %s fails',
    (failure) => {
      const { result, environment, calls, registryExists } = deploy(failure)
      expect(result.status).toBe(9)
      expect(environment).toContain('APP_VERSION=sha-7654321')
      expect(calls).toContain('up -d --no-deps --wait --wait-timeout 180 web')
      expect(registryExists).toBe(false)
    },
  )
  it('cleans up a failed first deployment without deleting media or attempting a nonexistent previous image', () => {
    const { result, environment, calls } = deploy('migration', true)
    expect(result.status).toBe(9)
    expect(environment).toContain('APP_VERSION=uninitialized')
    expect(calls).toContain('rm -sf web')
    expect(calls).not.toContain('down')
    expect(calls).not.toContain('up -d')
  })
  it('rejects an untrusted image tag before invoking Docker or modifying configuration', () => {
    const { result, calls, environment } = deploy('', false, 'latest;invalid')
    expect(result.status).toBe(2)
    expect(calls).toBe('')
    expect(environment).toContain('APP_VERSION=sha-7654321')
  })
})
