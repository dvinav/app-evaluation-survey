import { useTranslations } from 'next-intl'
import type { AnswerValue, Question } from '@/lib/validation'
export function RatingQuestion({
  question,
  value,
  onChange,
  invalid,
  disabled,
}: {
  question: Question
  value: AnswerValue | undefined
  onChange: (value: AnswerValue) => void
  invalid: boolean
  disabled: boolean
}) {
  const t = useTranslations('survey'),
    common = useTranslations('common')
  const number = new Intl.NumberFormat('fa')
  return (
    <fieldset
      className="rating-question"
      id={`question-${question.id}`}
      tabIndex={-1}
      disabled={disabled}
      aria-invalid={invalid}
      aria-describedby={invalid ? `error-${question.id}` : undefined}
    >
      <legend>
        {question.text}{' '}
        <span className="helper">
          ({common(question.required ? 'required' : 'optional')})
        </span>
      </legend>
      {question.description && <p className="muted">{question.description}</p>}
      <div className="scale-endpoints">
        <span>{t('scaleLow')}</span>
        <span>{t('scaleHigh')}</span>
      </div>
      <div className="rating-options">
        {[1, 2, 3, 4, 5, 6, 7].map((rating) => (
          <label className="rating-option" key={rating}>
            <input
              type="radio"
              name={question.id}
              value={rating}
              checked={value === rating}
              onChange={() => onChange(rating)}
              aria-label={t('ratingLabel', { rating })}
            />
            <span>{number.format(rating)}</span>
          </label>
        ))}
      </div>
      {question.allowNA && (
        <label className="check-row na-option">
          <input
            type="radio"
            name={question.id}
            value="na"
            checked={value === 'na'}
            onChange={() => onChange('na')}
          />
          {t('notApplicable')}
        </label>
      )}
      {!question.required && value != null && (
        <button
          type="button"
          className="text-button"
          onClick={() => onChange(null)}
        >
          {t('clearAnswer')}
        </button>
      )}
      {invalid && (
        <p className="field-error" id={`error-${question.id}`}>
          {t('validation.answersRequired')}
        </p>
      )}
    </fieldset>
  )
}
