import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto'
import { z } from 'zod'
import { snapshotSchema, type Snapshot } from './validation'
const tokenSchema = z.object({
  snapshot: snapshotSchema,
  submissionId: z.uuid(),
  issuedAt: z.number(),
  expiresAt: z.number(),
})
function secret() {
  const value = process.env.PAYLOAD_SECRET
  if (!value || value.length < 32)
    throw new Error('PAYLOAD_SECRET must have at least 32 characters')
  return value
}
export function questionnaireVersion(
  content: Omit<Snapshot, 'version'>,
): string {
  // Content hashing gives different modes and scoring definitions separate analysis strata.
  return createHash('sha256')
    .update(
      JSON.stringify({
        mode: content.mode,
        questions: content.questions,
        scale: content.scale,
      }),
    )
    .digest('hex')
}
export function signSnapshot(snapshot: Snapshot, now = Date.now()) {
  const body = Buffer.from(
    JSON.stringify({
      snapshot,
      submissionId: randomUUID(),
      issuedAt: now,
      expiresAt: now + 24 * 60 * 60 * 1000,
    }),
  ).toString('base64url')
  return `${body}.${createHmac('sha256', secret()).update(body).digest('base64url')}`
}
export function verifySnapshot(token: string, now = Date.now()) {
  const parts = token.split('.')
  if (parts.length !== 2) throw new Error('Invalid snapshot signature')
  const [body, signature] = parts
  const expected = createHmac('sha256', secret()).update(body).digest()
  const actual = Buffer.from(signature, 'base64url')
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    throw new Error('Invalid snapshot signature')
  const data = tokenSchema.parse(
    JSON.parse(Buffer.from(body, 'base64url').toString('utf8')),
  )
  if (data.expiresAt <= now || data.issuedAt > now)
    throw new Error('Expired snapshot')
  return data
}
