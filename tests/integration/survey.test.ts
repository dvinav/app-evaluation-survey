import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { getCMS } from '../../src/lib/payload'
import { sqlPool } from '../../src/lib/database'
import { seedDemo } from '../../scripts/seed'
import { getSurveyCatalog } from '../../src/lib/catalog'
import { persistSubmission } from '../../src/lib/submit'
import { researchData } from '../../src/lib/research-data'
import { rateLimit } from '../../src/lib/http'
import { POST, OPTIONS } from '../../src/app/(public)/api/survey/submit/route'
import { GET as exportGET } from '../../src/app/(public)/api/research/export/route'
import { GET as resultsGET } from '../../src/app/(public)/api/research/results/route'
import { participant } from '../fixtures'
let payload: Awaited<ReturnType<typeof getCMS>>
async function session(detailed = false) {
  const catalog = await getSurveyCatalog()
  if (!catalog.available) throw new Error('Test catalog unavailable')
  const instrument = detailed ? catalog.detailed : catalog.general
  if (!instrument) throw new Error('Test instrument unavailable')
  return {
    instrument,
    input: {
      token: instrument.token,
      participant: { ...participant, detailed },
      evaluations: instrument.snapshot.applications.map((app) => ({
        applicationId: app.id,
        answers: Object.fromEntries(
          instrument.snapshot.questions.map((q) => [
            q.id,
            q.required ? 7 : 'na',
          ]),
        ),
      })),
    },
  }
}
beforeAll(async () => {
  if (!new URL(process.env.DATABASE_URL!).pathname.endsWith('_test'))
    throw new Error('Disposable test database required')
  await sqlPool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public')
  payload = await getCMS()
  await payload.db.migrate()
  await seedDemo()
})
afterAll(async () => {
  if (payload) await payload.destroy()
  await sqlPool.end()
})
describe('transactional survey persistence on PostgreSQL', () => {
  it('stores multiple evaluations, raw ratings, snapshots, distinct NA and separate email', async () => {
    const { input, instrument } = await session()
    input.participant = {
      ...input.participant,
      receiveResults: true,
      email: 'synthetic@example.org',
    }
    await persistSubmission(input)
    const submissions = await payload.find({ collection: 'survey-submissions' })
    expect(submissions.totalDocs).toBe(1)
    expect(submissions.docs[0].snapshot).toMatchObject({
      questions: instrument.snapshot.questions,
    })
    const answers = await payload.find({ collection: 'question-responses' })
    expect(answers.totalDocs).toBe(4)
    expect(
      answers.docs
        .filter((a) => a.status === 'not-applicable')
        .every((a) => a.rating == null),
    ).toBe(true)
    expect(
      (await payload.count({ collection: 'research-results-contacts' }))
        .totalDocs,
    ).toBe(1)
    const data = await researchData({})
    expect(data.evaluations).toHaveLength(2)
    expect(data.answers).toHaveLength(4)
    expect(JSON.stringify(data)).not.toContain('synthetic@example.org')
  })
  it('makes sequential and concurrent retries idempotent', async () => {
    const { input } = await session()
    const before = (await payload.count({ collection: 'survey-submissions' }))
      .totalDocs
    await Promise.allSettled([
      persistSubmission(input),
      persistSubmission(input),
      persistSubmission(input),
    ])
    await persistSubmission(input)
    expect(
      (await payload.count({ collection: 'survey-submissions' })).totalDocs,
    ).toBe(before + 1)
    await expect(
      persistSubmission({
        ...input,
        participant: { ...input.participant, firstName: 'changed' },
      }),
    ).rejects.toMatchObject({ status: 409 })
  })
  it('keeps in-flight question text and versions after administrator edits', async () => {
    const { input, instrument } = await session()
    const question = (
      await payload.find({
        collection: 'general-questions',
        sort: 'displayOrder',
      })
    ).docs[0]
    await payload.update({
      collection: 'general-questions',
      id: question.id,
      data: { text: 'متن نمایشی ویرایش‌شده', version: 999 },
    })
    await persistSubmission(input)
    const records = await payload.find({
      collection: 'question-responses',
      sort: '-id',
      limit: 4,
    })
    expect(
      records.docs.find((r) => r.questionId === question.stableId)
        ?.questionText,
    ).toBe(instrument.snapshot.questions[0].text)
    expect(
      (
        await payload.findByID({
          collection: 'general-questions',
          id: question.id,
        })
      ).version,
    ).toBe(question.version + 1)
    const fresh = await session()
    expect(fresh.instrument.snapshot.version).not.toBe(
      instrument.snapshot.version,
    )
  })
  it('does not combine the two instruments', async () => {
    const { input } = await session(true)
    await persistSubmission(input)
    const data = await researchData({ mode: 'detailed' })
    expect(data.participants).toHaveLength(1)
    expect(
      data.answers.every((row) => row.questionnaire_mode === 'detailed'),
    ).toBe(true)
  })
  it('exports unanswered optional responses distinctly', async () => {
    const { input } = await session()
    for (const evaluation of input.evaluations)
      delete evaluation.answers['demo-02']
    await persistSubmission(input)
    const data = await researchData({})
    expect(
      data.answers.some(
        (row) =>
          row.response_status === 'unanswered' &&
          row.raw_rating === null &&
          row.not_applicable === false,
      ),
    ).toBe(true)
  })
  it('rolls back all records when the final contact write fails', async () => {
    const { input } = await session()
    input.participant = {
      ...input.participant,
      receiveResults: true,
      email: 'rollback@example.org',
    }
    const before = (await payload.count({ collection: 'survey-submissions' }))
      .totalDocs
    const original = payload.create.bind(payload)
    const spy = vi.spyOn(payload, 'create').mockImplementation((options) => {
      if (options.collection === 'research-results-contacts')
        throw new Error('Simulated final-write failure')
      return original(options)
    })
    try {
      await expect(persistSubmission(input)).rejects.toThrow('Simulated')
    } finally {
      spy.mockRestore()
    }
    expect(
      (await payload.count({ collection: 'survey-submissions' })).totalDocs,
    ).toBe(before)
    await persistSubmission(input)
    expect(
      (await payload.count({ collection: 'survey-submissions' })).totalDocs,
    ).toBe(before + 1)
  })
  it('rejects forged applications and ratings without writing', async () => {
    const { input } = await session()
    const before = (await payload.count({ collection: 'survey-submissions' }))
      .totalDocs
    await expect(
      persistSubmission({
        ...input,
        evaluations: [{ applicationId: 999, answers: { 'demo-01': 7 } }],
      }),
    ).rejects.toMatchObject({ status: 400 })
    await expect(
      persistSubmission({
        ...input,
        evaluations: [
          {
            applicationId: input.evaluations[0].applicationId,
            answers: { 'demo-01': 8 },
          },
        ],
      }),
    ).rejects.toMatchObject({ status: 400 })
    expect(
      (await payload.count({ collection: 'survey-submissions' })).totalDocs,
    ).toBe(before)
  })
  it('hides a withdrawn company and rejects its pending sessions', async () => {
    const { input, instrument } = await session()
    const companyId = instrument.snapshot.applications[0].companyId
    await payload.update({
      collection: 'companies',
      id: companyId,
      data: { participationStatus: 'withdrawn' },
    })
    try {
      await expect(persistSubmission(input)).rejects.toMatchObject({
        status: 409,
      })
      const catalog = await getSurveyCatalog()
      expect(catalog.available && catalog.general).toBeNull()
    } finally {
      await payload.update({
        collection: 'companies',
        id: companyId,
        data: { participationStatus: 'agreed' },
      })
    }
  })
  it('prevents publishing an application for an unapproved company', async () => {
    const company = await payload.create({
      collection: 'companies',
      data: { name: 'شرکت غیرمشارکت‌کننده', participationStatus: 'pending' },
    })
    const media = (await payload.find({ collection: 'media' })).docs[0]
    await expect(
      payload.create({
        collection: 'applications',
        data: {
          name: 'غیرمجاز',
          company: company.id,
          icon: media.id,
          active: true,
          public: true,
          displayOrder: 0,
        },
      }),
    ).rejects.toThrow()
  })
  it('allows intentional repeat participation with a new session', async () => {
    const before = (await payload.count({ collection: 'survey-submissions' }))
      .totalDocs
    await persistSubmission((await session()).input)
    await persistSubmission((await session()).input)
    expect(
      (await payload.count({ collection: 'survey-submissions' })).totalDocs,
    ).toBe(before + 2)
  })
})
describe('access and HTTP protections', () => {
  it('denies anonymous reads and writes through Payload access controls', async () => {
    for (const collection of [
      'companies',
      'applications',
      'survey-submissions',
      'application-evaluations',
      'question-responses',
      'research-results-contacts',
      'admin-users',
    ] as const) {
      await expect(
        payload.find({ collection, overrideAccess: false }),
      ).rejects.toThrow()
    }
    await expect(
      payload.create({
        collection: 'survey-submissions',
        overrideAccess: false,
        data: {
          submissionId: 'denied',
          requestHash: 'denied',
          background: 'other',
          mode: 'general',
          questionnaireVersion: 'denied',
          consentVersion: 'denied',
          consentedAt: new Date().toISOString(),
          snapshot: {},
        },
      }),
    ).rejects.toThrow()
    await expect(
      payload.create({
        collection: 'admin-users',
        data: {
          email: 'blocked@example.org',
          password: 'blocked-password-123',
          name: 'Blocked',
        },
      }),
    ).rejects.toThrow()
  })
  it('denies anonymous custom exports and results', async () => {
    expect(
      (
        await exportGET(
          new Request(
            'http://localhost:3000/api/research/export?dataset=answers&format=csv',
          ),
        )
      ).status,
    ).toBe(403)
    expect(
      (
        await resultsGET(
          new Request('http://localhost:3000/api/research/results'),
        )
      ).status,
    ).toBe(403)
  })
  it('protects collected data from authenticated API mutation and allows secure exports', async () => {
    const admin = await payload.create({
      collection: 'admin-users',
      context: { bootstrap: true },
      data: {
        email: 'admin@example.org',
        password: 'integration-password-at-least-16',
        name: 'Test Admin',
      },
    })
    const user = { ...admin, collection: 'admin-users' as const }
    const submission = (
      await payload.find({ collection: 'survey-submissions', limit: 1 })
    ).docs[0]
    await expect(
      payload.update({
        collection: 'survey-submissions',
        id: submission.id,
        overrideAccess: false,
        user,
        data: { consentVersion: 'tampered' },
      }),
    ).rejects.toThrow()
    const login = await payload.login({
      collection: 'admin-users',
      data: {
        email: 'admin@example.org',
        password: 'integration-password-at-least-16',
      },
    })
    const response = await exportGET(
      new Request(
        'http://localhost:3000/api/research/export?dataset=answers&format=json',
        { headers: { Authorization: `JWT ${login.token}` } },
      ),
    )
    expect(response.status).toBe(200)
    const body = await response.text()
    expect(body).toContain('raw_rating')
    expect(body).not.toContain('rollback@example.org')
    const csv = await exportGET(
      new Request(
        'http://localhost:3000/api/research/export?dataset=participants&format=csv',
        { headers: { Authorization: `JWT ${login.token}` } },
      ),
    )
    expect(csv.status).toBe(200)
    expect(await csv.text()).toContain('submission_id')
  })
  it('rejects foreign origins, malformed JSON and oversized bodies', async () => {
    expect(
      (
        await POST(
          new Request('http://localhost:3000/api/survey/submit', {
            method: 'POST',
            headers: {
              Origin: 'https://attacker.invalid',
              'Content-Type': 'application/json',
            },
            body: '{}',
          }),
        )
      ).status,
    ).toBe(403)
    const request = (body: string) =>
      new Request('http://localhost:3000/api/survey/submit', {
        method: 'POST',
        headers: {
          Origin: 'http://localhost:3000',
          'Content-Type': 'application/json',
        },
        body,
      })
    expect((await POST(request('invalid'))).status).toBe(400)
    expect((await POST(request(' '.repeat(512001)))).status).toBe(413)
  })
  it('persists mobile LAN submissions and supports preflight in development', async () => {
    const { input } = await session()
    const before = (await payload.count({ collection: 'survey-submissions' }))
      .totalDocs
    vi.stubEnv('NODE_ENV', 'development')
    try {
      const preflight = OPTIONS()
      expect(preflight.status).toBe(204)
      expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('*')
      const response = await POST(
        new Request('http://192.168.1.24:3000/api/survey/submit', {
          method: 'POST',
          headers: {
            Origin: 'http://192.168.1.24:3000',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(input),
        }),
      )
      expect(response.status).toBe(200)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(
        (await payload.count({ collection: 'survey-submissions' })).totalDocs,
      ).toBe(before + 1)
    } finally {
      vi.unstubAllEnvs()
    }
  })
  it('enforces database-backed request limits', async () => {
    await sqlPool.query('DELETE FROM survey_rate_limits')
    process.env.SUBMISSION_RATE_LIMIT = '1'
    try {
      await rateLimit(new Request('http://localhost:3000'))
      await expect(
        rateLimit(new Request('http://localhost:3000')),
      ).rejects.toMatchObject({ status: 429 })
    } finally {
      delete process.env.SUBMISSION_RATE_LIMIT
    }
  })
})
