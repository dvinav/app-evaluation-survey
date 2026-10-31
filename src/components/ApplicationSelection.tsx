import { useTranslations } from 'next-intl'
import type { Snapshot } from '@/lib/validation'
import { ApplicationIcon } from './ApplicationIcon'
export function ApplicationSelection({
  applications,
  selected,
  onChange,
  onBack,
  onNext,
  error,
}: {
  applications: Snapshot['applications']
  selected: number[]
  onChange: (id: number) => void
  onBack: () => void
  onNext: () => void
  error: boolean
}) {
  const t = useTranslations('survey')
  return (
    <div className="flow">
      <div className="heading-group">
        <h1 id="stage-title" tabIndex={-1}>
          {t('selectTitle')}
        </h1>
        <p className="muted">{t('selectHint')}</p>
      </div>
      <fieldset
        className="application-list"
        aria-describedby={error ? 'selection-error' : undefined}
      >
        <legend className="sr-only">{t('selectTitle')}</legend>
        {applications.map((app) => (
          <label key={app.id} className="application-card">
            <input
              type="checkbox"
              name="applications"
              value={app.id}
              checked={selected.includes(app.id)}
              onChange={() => onChange(app.id)}
            />
            <ApplicationIcon icon={app.icon} />
            <span>{app.name}</span>
          </label>
        ))}
      </fieldset>
      <p className="helper" aria-live="polite">
        {t('selected', { count: selected.length })}
      </p>
      {error && (
        <p className="field-error" id="selection-error" role="alert">
          {t('validation.selectionRequired')}
        </p>
      )}
      <div className="actions">
        <button type="button" className="secondary" onClick={onBack}>
          {t('previous')}
        </button>
        <button type="button" className="primary" onClick={onNext}>
          {t('next')}
        </button>
      </div>
    </div>
  )
}
