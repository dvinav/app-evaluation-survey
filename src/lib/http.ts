import { createHmac } from 'node:crypto'
import { sqlPool } from './database'
import { allowsSurveyOrigin } from './origins'
export class SurveyError extends Error {
  constructor(
    public code: 'sessionInvalid' | 'invalid' | 'rateLimited',
    public status: number,
  ) {
    super(code)
  }
}
export async function readSmallJSON(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new SurveyError('invalid', 415)
  if (!request.body) throw new SurveyError('invalid', 400)
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    length += value.byteLength
    if (length > 512000) {
      await reader.cancel()
      throw new SurveyError('invalid', 413)
    }
    chunks.push(value)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  } catch {
    throw new SurveyError('invalid', 400)
  }
}
export function assertOrigin(request: Request) {
  if (!allowsSurveyOrigin(request.headers.get('origin')))
    throw new SurveyError('invalid', 403)
}
export async function rateLimit(request: Request) {
  // Only trust a single header overwritten by a deployment-controlled reverse proxy.
  const header = process.env.TRUSTED_IP_HEADER
  const ip = header ? request.headers.get(header)?.trim() : undefined
  if (header && (!ip || ip.includes(',') || ip.length > 128))
    throw new SurveyError('invalid', 400)
  const bucket = createHmac('sha256', process.env.PAYLOAD_SECRET || '')
    .update(ip || 'shared')
    .digest('hex')
  const window = Math.floor(Date.now() / 600000)
  const result = await sqlPool.query<{ count: number }>(
    `INSERT INTO survey_rate_limits (bucket, window_start, count) VALUES ($1, $2, 1) ON CONFLICT (bucket) DO UPDATE SET window_start = EXCLUDED.window_start, count = CASE WHEN survey_rate_limits.window_start = EXCLUDED.window_start THEN survey_rate_limits.count + 1 ELSE 1 END RETURNING count`,
    [bucket, window],
  )
  // Expire network-derived hashes without retaining a history of participant IPs.
  await sqlPool.query(
    'DELETE FROM survey_rate_limits WHERE window_start < $1',
    [window - 1],
  )
  const limit = Number(
    process.env.SUBMISSION_RATE_LIMIT || (header ? '30' : '300'),
  )
  if (!Number.isInteger(limit) || limit < 1)
    throw new Error('Invalid SUBMISSION_RATE_LIMIT')
  if (result.rows[0].count > limit) throw new SurveyError('rateLimited', 429)
}
