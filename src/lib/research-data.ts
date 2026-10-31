import { z } from 'zod'
import type {
  CollectionSlug,
  DataFromCollectionSlug,
  Payload,
  Where,
} from 'payload'
import { getCMS } from './payload'
import type { Dataset, ExportRow } from './exports'
const date = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.iso.date().optional(),
)
export const filterSchema = z
  .object({
    from: date,
    to: date,
    mode: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.enum(['general', 'detailed']).optional(),
    ),
    application: z.coerce.number().int().positive().optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to)
export type ResearchFilters = z.infer<typeof filterSchema>
const idOf = (value: number | { id: number }) =>
  typeof value === 'number' ? value : value.id
async function all<T extends CollectionSlug>(
  payload: Payload,
  collection: T,
  transactionID: string | number,
  where?: Where,
): Promise<DataFromCollectionSlug<T>[]> {
  const documents: DataFromCollectionSlug<T>[] = []
  let page = 1
  for (;;) {
    const batch = await payload.find({
      collection,
      depth: 0,
      limit: 500,
      page,
      sort: 'id',
      where,
      req: { transactionID },
    })
    documents.push(...batch.docs)
    if (!batch.hasNextPage) break
    page++
  }
  return documents
}
export async function researchData(
  filters: ResearchFilters,
): Promise<Record<Dataset, ExportRow[]>> {
  const payload = await getCMS()
  const transactionID = await payload.db.beginTransaction({
    isolationLevel: 'repeatable read',
    accessMode: 'read only',
  })
  if (!transactionID) throw new Error('Database transaction unavailable')
  try {
    const where: Where = {
      and: [
        ...(filters.from
          ? [
              {
                createdAt: {
                  greater_than_equal: `${filters.from}T00:00:00.000Z`,
                },
              },
            ]
          : []),
        ...(filters.to
          ? [
              {
                createdAt: {
                  less_than: new Date(
                    new Date(`${filters.to}T00:00:00.000Z`).getTime() +
                      86400000,
                  ).toISOString(),
                },
              },
            ]
          : []),
        ...(filters.mode ? [{ mode: { equals: filters.mode } }] : []),
      ],
    }
    const submissions = await all(
      payload,
      'survey-submissions',
      transactionID,
      where,
    )
    const evaluations = await all(
      payload,
      'application-evaluations',
      transactionID,
    )
    const answers = await all(payload, 'question-responses', transactionID)
    const companies = await all(payload, 'companies', transactionID)
    const applications = await all(payload, 'applications', transactionID)
    const general = await all(payload, 'general-questions', transactionID)
    const detailed = await all(payload, 'detailed-questions', transactionID)
    const submissionMap = new Map(submissions.map((s) => [s.id, s]))
    const validEvaluations = evaluations.filter(
      (e) =>
        submissionMap.has(idOf(e.submission)) &&
        (!filters.application || idOf(e.application) === filters.application),
    )
    const evaluationMap = new Map(validEvaluations.map((e) => [e.id, e]))
    const selectedSubmissions = filters.application
      ? submissions.filter((s) =>
          validEvaluations.some((e) => idOf(e.submission) === s.id),
        )
      : submissions
    const questionRows = (questions: typeof general): ExportRow[] =>
      questions.map((q) => ({
        question_id: q.stableId,
        question_text: q.text,
        question_version: q.version,
        description: q.description || '',
        dimension: q.dimension || '',
        reverse_scored: !!q.reverseScored,
        required: !!q.required,
        allow_na: !!q.allowNA,
        active: !!q.active,
        display_order: q.displayOrder,
      }))
    const result = {
      participants: selectedSubmissions.map((s) => ({
        submission_id: s.submissionId,
        submitted_at: s.createdAt,
        background: s.background,
        questionnaire_mode: s.mode,
        questionnaire_version: s.questionnaireVersion,
        consent_version: s.consentVersion,
        consented_at: s.consentedAt,
      })),
      evaluations: validEvaluations.map((e) => ({
        evaluation_id: e.id,
        submission_id: submissionMap.get(idOf(e.submission))!.submissionId,
        application_id: idOf(e.application),
        application_name: e.applicationName,
        company_id: idOf(e.company),
        company_name: e.companyName,
        questionnaire_mode: e.mode,
        questionnaire_version: e.questionnaireVersion,
        evaluated_at: e.createdAt,
        question_count: e.questionCount,
      })),
      answers: answers.flatMap((a) => {
        const e = evaluationMap.get(idOf(a.evaluation))
        if (!e) return []
        return [
          {
            submission_id: submissionMap.get(idOf(e.submission))!.submissionId,
            evaluation_id: e.id,
            application_id: idOf(e.application),
            company_id: idOf(e.company),
            questionnaire_mode: e.mode,
            questionnaire_version: e.questionnaireVersion,
            question_id: a.questionId,
            question_text: a.questionText,
            question_version: a.questionVersion,
            dimension: a.dimension || '',
            required: !!a.required,
            raw_rating: a.rating ?? null,
            response_status: a.status,
            not_applicable: a.status === 'not-applicable',
            reverse_scored: !!a.reverseScored,
            scale_min: 1,
            scale_max: 7,
            answered_at: a.createdAt,
          },
        ]
      }),
      companies: companies.map((c) => ({
        company_id: c.id,
        company_name: c.name,
        website: c.website || '',
        participation_status: c.participationStatus,
        interview_agreement: !!c.interviewAgreement,
        interview_progress: c.interviewProgress || '',
      })),
      applications: applications.map((a) => ({
        application_id: a.id,
        application_name: a.name,
        company_id: idOf(a.company),
        url: a.url || '',
        category: a.category || '',
        active: !!a.active,
        public: !!a.public,
        display_order: a.displayOrder,
      })),
      generalQuestions: questionRows(general),
      detailedQuestions: questionRows(detailed),
    }
    await payload.db.commitTransaction(transactionID)
    return result
  } catch (error) {
    await payload.db.rollbackTransaction(transactionID)
    throw error
  }
}
