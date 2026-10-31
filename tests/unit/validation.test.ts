import { describe, expect, it } from 'vitest'
import {
  participantSchema,
  classifyParticipant,
  submissionSchema,
  validateEvaluations,
  answerValueSchema,
} from '../../src/lib/validation'
import { participant, snapshot } from '../fixtures'
describe('participant privacy and conditionals', () => {
  it('allows anonymous participation with blank optional identity', () =>
    expect(participantSchema.parse(participant).firstName).toBe(''))
  it('requires consent independently of email subscription', () =>
    expect(
      participantSchema.safeParse({
        ...participant,
        consent: false,
        receiveResults: true,
        email: 'user@example.org',
      }).success,
    ).toBe(false))
  it('does not require subscription to participate', () =>
    expect(participantSchema.safeParse(participant).success).toBe(true))
  it('requires a valid email only when requested', () => {
    expect(
      participantSchema.safeParse({ ...participant, receiveResults: true })
        .success,
    ).toBe(false)
    expect(
      participantSchema.safeParse({
        ...participant,
        receiveResults: true,
        email: 'broken',
      }).success,
    ).toBe(false)
    expect(
      participantSchema.parse({ ...participant, email: 'ignored' }).email,
    ).toBe('')
    expect(
      participantSchema.parse({
        ...participant,
        receiveResults: true,
        email: ' USER@EXAMPLE.ORG ',
      }).email,
    ).toBe('user@example.org')
  })
  it('clears hidden professional data', () => {
    expect(
      participantSchema.parse({
        ...participant,
        profileUrl: 'javascript:alert(1)',
      }).profileUrl,
    ).toBe('')
    const result = participantSchema.parse({
      ...participant,
      specialist: true,
      softwareRelated: true,
    })
    expect(result.softwareRelated).toBe(false)
    expect(classifyParticipant(result)).toBe('ui-ux')
  })
  it.each(['javascript:alert(1)', 'ftp://example.org', 'invalid'])(
    'rejects unsafe or malformed visible profile %s',
    (profileUrl) =>
      expect(
        participantSchema.safeParse({
          ...participant,
          specialist: true,
          profileUrl,
        }).success,
      ).toBe(false),
  )
  it('permits an optional blank or HTTPS professional URL', () => {
    expect(
      participantSchema.safeParse({
        ...participant,
        specialist: true,
        profileUrl: '',
      }).success,
    ).toBe(true)
    expect(
      participantSchema.safeParse({
        ...participant,
        specialist: true,
        profileUrl: 'https://example.org',
      }).success,
    ).toBe(true)
  })
  it('distinguishes the three professional categories', () => {
    expect(classifyParticipant(participantSchema.parse(participant))).toBe(
      'other',
    )
    expect(
      classifyParticipant(
        participantSchema.parse({ ...participant, softwareRelated: true }),
      ),
    ).toBe('software')
  })
})
describe('instrument and evaluation validation', () => {
  const input = {
    token: 'signed',
    participant,
    evaluations: [{ applicationId: 1, answers: { q1: 7, q2: 'na' } }],
  }
  it.each([0, 8, 1.5, '7', NaN])(
    'rejects a rating outside integer 1–7: %s',
    (value) => expect(answerValueSchema.safeParse(value).success).toBe(false),
  )
  it.each([1, 2, 3, 4, 5, 6, 7, null, 'na'])(
    'accepts scale or distinct missing/NA value: %s',
    (value) => expect(answerValueSchema.safeParse(value).success).toBe(true),
  )
  it('requires at least one application', () =>
    expect(
      submissionSchema.safeParse({ ...input, evaluations: [] }).success,
    ).toBe(false))
  it('accepts independent evaluations for multiple selected applications', () =>
    expect(
      validateEvaluations(
        snapshot,
        submissionSchema.parse({
          ...input,
          evaluations: [
            ...input.evaluations,
            { applicationId: 2, answers: { q1: 2 } },
          ],
        }),
      ),
    ).toBe(true))
  it('rejects duplicate and unknown applications', () => {
    expect(
      validateEvaluations(
        snapshot,
        submissionSchema.parse({
          ...input,
          evaluations: [...input.evaluations, ...input.evaluations],
        }),
      ),
    ).toBe(false)
    expect(
      validateEvaluations(
        snapshot,
        submissionSchema.parse({
          ...input,
          evaluations: [{ applicationId: 999, answers: { q1: 2 } }],
        }),
      ),
    ).toBe(false)
  })
  it('rejects missing required and unknown questions', () => {
    for (const answers of [
      { q2: 3 },
      { q1: null },
      { q1: 2, forged: 3 },
      { q1: 'na' },
    ])
      expect(
        validateEvaluations(
          snapshot,
          submissionSchema.parse({
            ...input,
            evaluations: [{ applicationId: 1, answers }],
          }),
        ),
      ).toBe(false)
  })
  it('requires selected mode to match the snapshot', () =>
    expect(
      validateEvaluations(
        snapshot,
        submissionSchema.parse({
          ...input,
          participant: { ...participant, detailed: true },
        }),
      ),
    ).toBe(false))
})
