import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  allowsSurveyOrigin,
  publicMediaURL,
  surveyResponseHeaders,
} from '../../src/lib/origins'
afterEach(() => vi.unstubAllEnvs())
describe('development and production origins', () => {
  it('accepts LAN and arbitrary origins only during development', () => {
    vi.stubEnv('NODE_ENV', 'development')
    for (const origin of [
      'http://192.168.1.24:3000',
      'https://preview.research.test',
      'null',
      null,
    ])
      expect(allowsSurveyOrigin(origin)).toBe(true)
    expect(surveyResponseHeaders()).toMatchObject({
      'Access-Control-Allow-Origin': '*',
    })
  })
  it('keeps production restricted to the exact configured origin', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('SERVER_URL', 'https://research.example.org')
    expect(allowsSurveyOrigin('https://research.example.org')).toBe(true)
    for (const origin of [
      'http://192.168.1.24:3000',
      'https://attacker.invalid',
      'http://research.example.org',
      null,
    ])
      expect(allowsSurveyOrigin(origin)).toBe(false)
    expect(surveyResponseHeaders()).not.toHaveProperty(
      'Access-Control-Allow-Origin',
    )
  })
  it('does not weaken origin checks in other runtime modes', () => {
    vi.stubEnv('NODE_ENV', 'test')
    expect(allowsSurveyOrigin('https://attacker.invalid')).toBe(false)
  })
})
describe('mobile-safe uploaded media URLs', () => {
  it('serves local icons relative to the browser origin, preserving their query', () => {
    vi.stubEnv('SERVER_URL', 'http://localhost:3000')
    expect(
      publicMediaURL('http://localhost:3000/api/media/file/icon.png?size=96'),
    ).toBe('/api/media/file/icon.png?size=96')
    expect(publicMediaURL('/api/media/file/icon.png')).toBe(
      '/api/media/file/icon.png',
    )
    expect(publicMediaURL('')).toBe('')
    vi.stubEnv('SERVER_URL', 'https://research.example.org')
    expect(
      publicMediaURL('http://localhost:3000/api/media/file/icon.png'),
    ).toBe('/api/media/file/icon.png')
  })
  it('preserves separately hosted media', () =>
    expect(publicMediaURL('https://cdn.example.org/icon.png')).toBe(
      'https://cdn.example.org/icon.png',
    ))
})
