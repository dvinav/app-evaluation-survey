import { createHash } from 'node:crypto'
import { getCMS } from './payload'
import { verifySnapshot } from './snapshot'
import {
  classifyParticipant,
  submissionSchema,
  validateEvaluations,
} from './validation'
import { SurveyError } from './http'
export async function persistSubmission(input: unknown) {
  const parsed = submissionSchema.safeParse(input)
  if (!parsed.success) throw new SurveyError('invalid', 400)
  const data = parsed.data
  let session: ReturnType<typeof verifySnapshot>
  try {
    session = verifySnapshot(data.token)
  } catch {
    throw new SurveyError('sessionInvalid', 409)
  }
  const { snapshot, submissionId } = session
  if (!validateEvaluations(snapshot, data))
    throw new SurveyError('invalid', 400)
  const payload = await getCMS()
  const requestHash = createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex')
  async function existing() {
    const found = await payload.find({
      collection: 'survey-submissions',
      where: { submissionId: { equals: submissionId } },
      limit: 1,
      depth: 0,
    })
    const record = found.docs[0]
    if (record && record.requestHash !== requestHash)
      throw new SurveyError('sessionInvalid', 409)
    return !!record
  }
  if (await existing()) return
  const transactionID = await payload.db.beginTransaction({
    isolationLevel: 'serializable',
  })
  if (!transactionID) throw new Error('Transactional database is required')
  const req = { transactionID }
  try {
    const settings = await payload.findGlobal({
      slug: 'research-settings',
      req,
    })
    if (!settings.available) throw new SurveyError('sessionInvalid', 409)
    // Recheck eligibility at commit time, while retaining the signed historical questions.
    for (const evaluation of data.evaluations) {
      const app = snapshot.applications.find(
        (application) => application.id === evaluation.applicationId,
      )!
      const currentApp = await payload.findByID({
        collection: 'applications',
        id: app.id,
        depth: 0,
        req,
      })
      const company = await payload.findByID({
        collection: 'companies',
        id: app.companyId,
        req,
      })
      if (
        !currentApp.active ||
        !currentApp.public ||
        currentApp.company !== app.companyId ||
        company.participationStatus !== 'agreed' ||
        !company.interviewAgreement
      )
        throw new SurveyError('sessionInvalid', 409)
    }
    const now = new Date().toISOString()
    const submission = await payload.create({
      collection: 'survey-submissions',
      req,
      data: {
        submissionId,
        requestHash,
        firstName: data.participant.firstName,
        surname: data.participant.surname,
        background: classifyParticipant(data.participant),
        profileUrl: data.participant.profileUrl,
        mode: snapshot.mode,
        questionnaireVersion: snapshot.version,
        consentVersion: snapshot.consent.version,
        consentedAt: now,
        snapshot,
      },
    })
    for (const evaluation of data.evaluations) {
      const app = snapshot.applications.find(
        (application) => application.id === evaluation.applicationId,
      )!
      const record = await payload.create({
        collection: 'application-evaluations',
        req,
        data: {
          submission: submission.id,
          application: app.id,
          company: app.companyId,
          applicationName: app.name,
          companyName: app.companyName,
          mode: snapshot.mode,
          questionnaireVersion: snapshot.version,
          questionCount: snapshot.questions.length,
        },
      })
      for (const question of snapshot.questions) {
        const value = evaluation.answers[question.id]
        await payload.create({
          collection: 'question-responses',
          req,
          data: {
            evaluation: record.id,
            questionId: question.id,
            questionText: question.text,
            questionVersion: question.version,
            dimension: question.dimension,
            reverseScored: question.reverseScored,
            required: question.required,
            status:
              typeof value === 'number'
                ? 'rated'
                : value === 'na'
                  ? 'not-applicable'
                  : 'unanswered',
            rating: typeof value === 'number' ? value : null,
          },
        })
      }
    }
    if (data.participant.receiveResults)
      await payload.create({
        collection: 'research-results-contacts',
        req,
        data: {
          email: data.participant.email,
          submission: submission.id,
          subscribedAt: now,
        },
      })
    await payload.db.commitTransaction(transactionID)
  } catch (error) {
    await payload.db.rollbackTransaction(transactionID)
    // A concurrent identical retry can lose the unique-key race after the first commits.
    if (await existing()) return
    throw error
  }
}
