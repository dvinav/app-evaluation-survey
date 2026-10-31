import { getSurveyCatalog } from '@/lib/catalog'
import { Survey } from '@/components/Survey'
import { getTranslations } from 'next-intl/server'
export const dynamic = 'force-dynamic'
export default async function Page() {
  const catalog = await getSurveyCatalog()
  const t = await getTranslations('survey')
  if (!catalog.available)
    return (
      <section className="notice">
        <h1>{t('closedTitle')}</h1>
        <p>{catalog.closingMessage || t('closedMessage')}</p>
      </section>
    )
  if (!catalog.general && !catalog.detailed)
    return (
      <section className="notice">
        <h1>{t('emptyTitle')}</h1>
        <p>{t('emptyMessage')}</p>
      </section>
    )
  return <Survey catalog={catalog} />
}
