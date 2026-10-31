'use client'
import { useForm, useWatch } from 'react-hook-form'
import { Reveal } from './Reveal'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import {
  participantSchema,
  type Participant,
  type ParticipantInput,
  type Snapshot,
} from '@/lib/validation'
export function ParticipantForm({
  initial,
  consent,
  onContinue,
  questionCounts,
}: {
  initial: ParticipantInput
  consent: Snapshot['consent']
  onContinue: (participant: Participant) => void
  questionCounts: { general: number; detailed: number }
}) {
  const t = useTranslations('survey')
  const common = useTranslations('common')
  const {
    register,
    control,
    setValue,
    clearErrors,
    handleSubmit,
    formState: { errors },
  } = useForm<ParticipantInput, unknown, Participant>({
    resolver: zodResolver(participantSchema),
    defaultValues: initial,
  })
  const specialist = useWatch({ control, name: 'specialist' }),
    receiveResults = useWatch({ control, name: 'receiveResults' })
  function message(key: string | undefined) {
    if (
      key === 'consentRequired' ||
      key === 'emailInvalid' ||
      key === 'profileInvalid'
    )
      return t(`validation.${key}`)
    return t('validation.invalid')
  }
  return (
    <form onSubmit={handleSubmit(onContinue)} noValidate className="flow">
      <div className="heading-group">
        <h1 tabIndex={-1} id="stage-title">
          {t('participantTitle')}
        </h1>
        <p>{consent.introduction}</p>
        <p className="muted">{t('participantHint')}</p>
      </div>
      <div className="identity-fields">
        {(['firstName', 'surname'] as const).map((name) => (
          <div className="field" key={name}>
            <label htmlFor={name}>
              {t(name)} <span className="muted">({common('optional')})</span>
            </label>
            <input
              id={name}
              autoComplete={name === 'firstName' ? 'given-name' : 'family-name'}
              {...register(name)}
              maxLength={100}
              aria-invalid={!!errors[name]}
              aria-describedby={errors[name] ? `${name}-error` : undefined}
            />
            {errors[name] && (
              <p className="field-error" id={`${name}-error`}>
                {message(errors[name]?.message)}
              </p>
            )}
          </div>
        ))}
      </div>
      <div className="field">
        <label className="check-row">
          <input
            type="checkbox"
            {...register('specialist', {
              onChange: (event) => {
                if (event.target.checked) setValue('softwareRelated', false)
                else {
                  setValue('profileUrl', '')
                  clearErrors('profileUrl')
                }
              },
            })}
          />
          {t('specialist')}
        </label>
        <Reveal open={specialist}>
          <div className="field conditional">
            <label htmlFor="profileUrl">
              {t('profileUrl')}{' '}
              <span className="muted">({common('optional')})</span>
            </label>
            <input
              id="profileUrl"
              type="url"
              dir="ltr"
              autoComplete="url"
              {...register('profileUrl')}
              aria-invalid={!!errors.profileUrl}
              aria-describedby={errors.profileUrl ? 'profile-error' : undefined}
            />
            {errors.profileUrl && (
              <p id="profile-error" className="field-error">
                {message(errors.profileUrl.message)}
              </p>
            )}
          </div>
        </Reveal>
        <Reveal open={!specialist}>
          <label className="check-row">
            <input type="checkbox" {...register('softwareRelated')} />
            {t('softwareRelated')}
          </label>
        </Reveal>
      </div>
      <div className="field">
        <label className="check-row">
          <input
            type="checkbox"
            {...register('receiveResults', {
              onChange: (event) => {
                if (!event.target.checked) {
                  setValue('email', '')
                  clearErrors('email')
                }
              },
            })}
          />
          {t('receiveResults')}
        </label>
        <Reveal open={receiveResults}>
          <div className="field conditional">
            <label htmlFor="email">{t('email')}</label>
            <input
              id="email"
              type="email"
              dir="ltr"
              autoComplete="email"
              {...register('email')}
              aria-required="true"
              aria-invalid={!!errors.email}
              aria-describedby="email-hint email-error"
            />
            <p id="email-hint" className="helper">
              {t('emailPrivacy')}
            </p>
            {errors.email && (
              <p id="email-error" className="field-error">
                {message(errors.email.message)}
              </p>
            )}
          </div>
        </Reveal>
      </div>
      <div className="field">
        <label className="check-row">
          <input
            type="checkbox"
            aria-describedby="questionnaire-description"
            {...register('detailed')}
          />
          {t('detailed')}
        </label>
        <div
          id="questionnaire-description"
          className="questionnaire-description"
        >
          <p>{t('detailedHint', questionCounts)}</p>
          <p className="helper">
            {questionCounts.detailed > questionCounts.general
              ? t('detailedMoreHint', {
                  extra: questionCounts.detailed - questionCounts.general,
                })
              : t('detailedIndependentHint')}
          </p>
        </div>
      </div>
      <section className="consent flow">
        <h2>{t('consentTitle')}</h2>
        <p className="preserve-lines">{consent.text}</p>
        <p>
          {t('contactLabel')} <bdi>{consent.contact}</bdi>
        </p>
        <label className="check-row">
          <input
            type="checkbox"
            {...register('consent')}
            aria-invalid={!!errors.consent}
            aria-describedby={errors.consent ? 'consent-error' : undefined}
          />
          {t('consent')}
        </label>
        {errors.consent && (
          <p className="field-error" id="consent-error" role="alert">
            {message(errors.consent.message)}
          </p>
        )}
      </section>
      <div className="actions">
        <button type="submit" className="primary">
          {t('next')}
        </button>
      </div>
    </form>
  )
}
