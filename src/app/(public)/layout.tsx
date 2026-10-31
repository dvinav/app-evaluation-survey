import Link from 'next/link'
import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { ThemeProvider, ThemeToggle } from '@/components/ThemeProvider'
import messages from '../../../messages/fa.json' with { type: 'json' }
import '@fontsource-variable/vazirmatn'
import './globals.css'
export const metadata: Metadata = {
  title: messages.common.brand,
  description: messages.common.research,
  robots: { index: false, follow: false },
}
export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = await getTranslations('common')
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body>
        <NextIntlClientProvider>
          <ThemeProvider>
            <a className="skip-link" href="#main">
              {t('skip')}
            </a>
            <header className="site-header">
              <div className="shell header-inner">
                <Link href="/" className="brand">
                  {t('brand')}
                  <span>{t('research')}</span>
                </Link>
                <ThemeToggle />
              </div>
            </header>
            <main id="main" className="shell isolate">
              {children}
            </main>
            <footer className="shell footer">
              <p>{t('footer')}</p>
            </footer>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
