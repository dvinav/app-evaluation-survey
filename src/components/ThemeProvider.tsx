'use client'
import { ThemeProvider as Provider, useTheme } from 'next-themes'
import { useTranslations } from 'next-intl'
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider attribute="data-theme" defaultTheme="system" enableSystem>
      {children}
    </Provider>
  )
}
export function ThemeToggle() {
  const { setTheme } = useTheme()
  const t = useTranslations('common')
  return (
    <details className="theme-menu">
      <summary>{t('theme')}</summary>
      <div>
        {(['system', 'light', 'dark'] as const).map((theme) => (
          <button type="button" key={theme} onClick={() => setTheme(theme)}>
            {t(theme)}
          </button>
        ))}
      </div>
    </details>
  )
}
