import Link from 'next/link'
import { createTranslator } from 'next-intl'
import messages from '../../messages/fa.json' with { type: 'json' }
import '@fontsource-variable/vazirmatn'
import './(public)/globals.css'
const t = createTranslator({ locale: 'fa', messages, namespace: 'common' })
export default function NotFound() {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <main className="shell notice">
          <h1>{t('notFound')}</h1>
          <p>{t('notFoundMessage')}</p>
          <Link href="/">{t('home')}</Link>
        </main>
      </body>
    </html>
  )
}
