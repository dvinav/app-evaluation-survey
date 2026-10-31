import { publicMediaURL } from './origins'
import { getCMS } from './payload'
import { questionnaireVersion, signSnapshot } from './snapshot'
import type { Snapshot } from './validation'
import messages from '../../messages/fa.json' with { type: 'json' }
export async function getSurveyCatalog() {
  const payload = await getCMS()
  const settings = await payload.findGlobal({ slug: 'research-settings' })
  if (!settings.available)
    return {
      available: false as const,
      closingMessage: settings.closingMessage,
    }
  const [companies, applications, general, detailed] = await Promise.all([
    payload.find({
      collection: 'companies',
      where: {
        and: [
          { participationStatus: { equals: 'agreed' } },
          { interviewAgreement: { equals: true } },
        ],
      },
      pagination: false,
      depth: 0,
    }),
    payload.find({
      collection: 'applications',
      where: {
        and: [{ active: { equals: true } }, { public: { equals: true } }],
      },
      sort: 'displayOrder',
      pagination: false,
      depth: 1,
    }),
    payload.find({
      collection: 'general-questions',
      where: { active: { equals: true } },
      sort: 'displayOrder',
      pagination: false,
    }),
    payload.find({
      collection: 'detailed-questions',
      where: { active: { equals: true } },
      sort: 'displayOrder',
      pagination: false,
    }),
  ])
  const companyMap = new Map(
    companies.docs.map((company) => [company.id, company]),
  )
  const apps: Snapshot['applications'] = applications.docs.flatMap(
    (application) => {
      const companyId =
        typeof application.company === 'number'
          ? application.company
          : application.company.id
      const company = companyMap.get(companyId)
      if (!company) return []
      const icon =
        typeof application.icon === 'object'
          ? application.icon.sizes?.icon?.url || application.icon.url || ''
          : ''
      return [
        {
          id: application.id,
          name: application.name,
          companyId,
          companyName: company.name,
          icon: publicMediaURL(icon),
        },
      ]
    },
  )
  function instrument(mode: 'general' | 'detailed', docs: typeof general.docs) {
    if (!docs.length || !apps.length || docs.length > 100 || apps.length > 100)
      return null
    const content: Omit<Snapshot, 'version'> = {
      mode,
      applications: apps,
      questions: docs.map((question) => ({
        id: question.stableId,
        text: question.text,
        description: question.description || '',
        version: question.version,
        required: !!question.required,
        allowNA: !!question.allowNA,
        dimension: question.dimension || '',
        reverseScored: !!question.reverseScored,
      })),
      consent: {
        text: settings.consentText,
        version: settings.consentVersion,
        contact: settings.contact,
        title: settings.title,
        introduction: settings.introduction,
      },
      scale: {
        min: 1,
        max: 7,
        low: messages.survey.scaleLow,
        high: messages.survey.scaleHigh,
      },
    }
    const snapshot = { ...content, version: questionnaireVersion(content) }
    return { snapshot, token: signSnapshot(snapshot) }
  }
  return {
    available: true as const,
    title: settings.title,
    description: settings.description,
    introduction: settings.introduction,
    general: instrument('general', general.docs),
    detailed: instrument('detailed', detailed.docs),
  }
}
export type SurveyCatalog = Awaited<ReturnType<typeof getSurveyCatalog>>
