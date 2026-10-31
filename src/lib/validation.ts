import { z } from 'zod'
const optionalName = z.string().trim().max(100).default('')
const safeUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    if (!value) return true
    try {
      return ['http:', 'https:'].includes(new URL(value).protocol)
    } catch {
      return false
    }
  }, 'profileInvalid')
export const participantSchema = z
  .object({
    firstName: optionalName,
    surname: optionalName,
    specialist: z.boolean(),
    softwareRelated: z.boolean(),
    profileUrl: z.string().default(''),
    receiveResults: z.boolean(),
    email: z.string().default(''),
    detailed: z.boolean(),
    consent: z.boolean().refine((value) => value, 'consentRequired'),
  })
  .superRefine((data, ctx) => {
    if (data.receiveResults && !z.email().safeParse(data.email.trim()).success)
      ctx.addIssue({ code: 'custom', path: ['email'], message: 'emailInvalid' })
    if (data.specialist && !safeUrl.safeParse(data.profileUrl).success)
      ctx.addIssue({
        code: 'custom',
        path: ['profileUrl'],
        message: 'profileInvalid',
      })
  })
  .transform((data) => ({
    ...data,
    softwareRelated: !data.specialist && data.softwareRelated,
    profileUrl: data.specialist ? data.profileUrl.trim() : '',
    email: data.receiveResults ? data.email.trim().toLowerCase() : '',
  }))
export type ParticipantInput = z.input<typeof participantSchema>
export type Participant = z.output<typeof participantSchema>
export function classifyParticipant(
  participant: Pick<Participant, 'specialist' | 'softwareRelated'>,
) {
  return participant.specialist
    ? 'ui-ux'
    : participant.softwareRelated
      ? 'software'
      : 'other'
}
export const questionSchema = z.object({
  id: z.string(),
  text: z.string(),
  description: z.string(),
  version: z.number().int().positive(),
  required: z.boolean(),
  allowNA: z.boolean(),
  dimension: z.string(),
  reverseScored: z.boolean(),
})
export const snapshotSchema = z.object({
  version: z.string(),
  mode: z.enum(['general', 'detailed']),
  questions: z.array(questionSchema).min(1).max(100),
  applications: z
    .array(
      z.object({
        id: z.number().int(),
        name: z.string(),
        companyId: z.number().int(),
        companyName: z.string(),
        icon: z.string(),
      }),
    )
    .min(1)
    .max(100),
  consent: z.object({
    text: z.string(),
    version: z.string(),
    contact: z.string(),
    title: z.string(),
    introduction: z.string(),
  }),
  scale: z.object({
    min: z.literal(1),
    max: z.literal(7),
    low: z.string(),
    high: z.string(),
  }),
})
export type Snapshot = z.infer<typeof snapshotSchema>
export type Question = Snapshot['questions'][number]
export const answerValueSchema = z.union([
  z.number().int().min(1).max(7),
  z.literal('na'),
  z.null(),
])
export type AnswerValue = z.infer<typeof answerValueSchema>
export const submissionSchema = z
  .object({
    token: z.string().max(300000),
    participant: participantSchema,
    evaluations: z
      .array(
        z.object({
          applicationId: z.number().int(),
          answers: z.record(z.string().max(100), answerValueSchema),
        }),
      )
      .min(1)
      .max(100),
  })
  .strict()
export type Submission = z.infer<typeof submissionSchema>
export function validateEvaluations(
  snapshot: Snapshot,
  submission: Submission,
) {
  if (
    (submission.participant.detailed ? 'detailed' : 'general') !== snapshot.mode
  )
    return false
  const appIds = new Set(snapshot.applications.map((app) => app.id))
  const seen = new Set<number>()
  const questionIds = new Set(snapshot.questions.map((question) => question.id))
  for (const evaluation of submission.evaluations) {
    if (
      !appIds.has(evaluation.applicationId) ||
      seen.has(evaluation.applicationId)
    )
      return false
    seen.add(evaluation.applicationId)
    if (Object.keys(evaluation.answers).some((id) => !questionIds.has(id)))
      return false
    for (const question of snapshot.questions) {
      const answer = evaluation.answers[question.id]
      if (question.required && answer == null) return false
      if (answer === 'na' && !question.allowNA) return false
    }
  }
  return true
}
