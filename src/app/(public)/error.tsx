'use client'
import { useTranslations } from 'next-intl'
export default function ErrorPage({ reset }: { reset: () => void }) {
  const t = useTranslations('common')
  return (
    <section className="notice" role="alert">
      <p>{t('error')}</p>
      <button type="button" className="primary" onClick={reset}>
        {t('retry')}
      </button>
    </section>
  )
}
