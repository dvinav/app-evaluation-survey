'use client'
/* A fresh request issues a new signed session for intentional repeat participation. */
/* eslint-disable @next/next/no-html-link-for-pages */
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { SurveyCatalog } from '@/lib/catalog'
import type {
  AnswerValue,
  Participant,
  ParticipantInput,
} from '@/lib/validation'
import { ParticipantForm } from './ParticipantForm'
import { ApplicationSelection } from './ApplicationSelection'
import { RatingQuestion } from './RatingQuestion'
import { ApplicationIcon } from './ApplicationIcon'
import { useSurveyTransition } from './useSurveyTransition'
type Catalog = Extract<SurveyCatalog, { available: true }>
const defaults: ParticipantInput = {
  firstName: '',
  surname: '',
  specialist: false,
  softwareRelated: false,
  profileUrl: '',
  receiveResults: false,
  email: '',
  detailed: false,
  consent: false,
}
export function Survey({ catalog }: { catalog: Catalog }) {
  const t = useTranslations('survey')
  const transition = useSurveyTransition()
  const [participant, setParticipant] = useState<ParticipantInput>(defaults)
  const [step, setStep] = useState(0),
    [appIndex, setAppIndex] = useState(0)
  const [selected, setSelected] = useState<number[]>([])
  const [answers, setAnswers] = useState<
    Record<number, Record<string, AnswerValue>>
  >({})
  const [invalid, setInvalid] = useState<string[]>([]),
    [selectionError, setSelectionError] = useState(false)
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const [submissionBody, setSubmissionBody] = useState<string | null>(null)
  const instrument = participant.detailed ? catalog.detailed : catalog.general
  const consent = (catalog.general || catalog.detailed)!.snapshot.consent
  const applications =
    instrument?.snapshot.applications.filter((app) =>
      selected.includes(app.id),
    ) || []
  const app = applications[appIndex]
  useEffect(() => {
    document.getElementById('stage-title')?.focus({ preventScroll: true })
  }, [step, appIndex])
  function continueParticipant(data: Participant) {
    if (data.detailed !== participant.detailed) {
      setAnswers({})
      setSelected([])
    }
    setParticipant(data)
    transition('forward', () => setStep(1))
    setInvalid([])
    setError('')
  }
  async function nextEvaluation() {
    if (!instrument || !app) return
    const missing = instrument.snapshot.questions
      .filter((q) => q.required && answers[app.id]?.[q.id] == null)
      .map((q) => q.id)
    setInvalid(missing)
    if (missing.length) {
      document.getElementById(`question-${missing[0]}`)?.focus()
      return
    }
    if (appIndex < applications.length - 1) {
      transition('forward', () => setAppIndex(appIndex + 1))
      return
    }
    const body =
      submissionBody ||
      JSON.stringify({
        token: instrument.token,
        participant,
        evaluations: applications.map((application) => ({
          applicationId: application.id,
          answers: answers[application.id] || {},
        })),
      })
    setSubmissionBody(body)
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/survey/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      if (!response.ok) {
        const result: unknown = await response.json()
        const code =
          result && typeof result === 'object' && 'error' in result
            ? result.error
            : ''
        setError(
          code === 'sessionInvalid'
            ? 'sessionInvalid'
            : code === 'rateLimited'
              ? 'rateLimited'
              : 'submissionFailed',
        )
        return
      }
      // Clear optional identifying fields and raw answers from React state after receipt.
      setParticipant(defaults)
      setAnswers({})
      setSubmissionBody(null)
      transition('forward', () => setStep(3))
    } catch {
      setError('submissionFailed')
    } finally {
      setBusy(false)
    }
  }
  const steps = [
    'participant',
    'applications',
    'evaluation',
    'confirmation',
  ] as const
  return (
    <div className="survey">
      <div className="research-heading">
        <p className="eyebrow">{t('step', { current: step + 1, total: 4 })}</p>
        <h2>{catalog.title}</h2>
        <p className="muted">{catalog.description}</p>
      </div>
      <nav aria-label={t('progress')}>
        <ol className="progress" role="list">
          {steps.map((name, index) => (
            <li
              key={name}
              aria-current={index === step ? 'step' : undefined}
              data-complete={index < step}
            >
              <span className="step-number" aria-hidden="true">
                {new Intl.NumberFormat('fa').format(index + 1)}
              </span>
              <span>{t(`steps.${name}`)}</span>
            </li>
          ))}
        </ol>
      </nav>
      <div className="survey-content">
        {step === 0 && (
          <ParticipantForm
            initial={participant}
            consent={consent}
            onContinue={continueParticipant}
            questionCounts={{
              general: catalog.general?.snapshot.questions.length || 0,
              detailed: catalog.detailed?.snapshot.questions.length || 0,
            }}
          />
        )}
        {step === 1 &&
          (instrument ? (
            <ApplicationSelection
              applications={instrument.snapshot.applications}
              selected={selected}
              onChange={(id) => {
                setSelected((previous) =>
                  previous.includes(id)
                    ? previous.filter((value) => value !== id)
                    : [...previous, id],
                )
                setSelectionError(false)
              }}
              onBack={() => transition('back', () => setStep(0))}
              onNext={() => {
                if (!selected.length) {
                  setSelectionError(true)
                  return
                }
                transition('forward', () => {
                  setAppIndex(0)
                  setStep(2)
                  setInvalid([])
                })
              }}
              error={selectionError}
            />
          ) : (
            <section className="flow">
              <h1 id="stage-title" tabIndex={-1}>
                {t('emptyTitle')}
              </h1>
              <p>{t('emptyMessage')}</p>
              <button
                type="button"
                className="secondary"
                onClick={() => transition('back', () => setStep(0))}
              >
                {t('previous')}
              </button>
            </section>
          ))}
        {step === 2 && instrument && app && (
          <div className="flow">
            <div className="evaluation-header">
              <ApplicationIcon icon={app.icon} />
              <div>
                <p className="helper">
                  {t('applicationProgress', {
                    current: appIndex + 1,
                    total: applications.length,
                  })}
                </p>
                <h1 id="stage-title" tabIndex={-1}>
                  {app.name}
                </h1>
              </div>
            </div>
            <div className="heading-group">
              <h2>{t('evaluationTitle')}</h2>
              <p className="muted">{t('evaluationHint')}</p>
            </div>
            <div className="questions">
              {instrument.snapshot.questions.map((q) => (
                <RatingQuestion
                  key={`${app.id}-${q.id}`}
                  question={q}
                  value={answers[app.id]?.[q.id]}
                  disabled={busy || !!submissionBody}
                  invalid={invalid.includes(q.id)}
                  onChange={(value) => {
                    setAnswers((previous) => ({
                      ...previous,
                      [app.id]: { ...previous[app.id], [q.id]: value },
                    }))
                    setInvalid((previous) =>
                      previous.filter((id) => id !== q.id),
                    )
                  }}
                />
              ))}
            </div>
            {error && (
              <p role="alert" className="field-error">
                {t(`validation.${error}`)}
              </p>
            )}
            <div className="actions">
              <button
                type="button"
                className="secondary"
                disabled={busy || !!submissionBody}
                onClick={() => {
                  setInvalid([])
                  transition('back', () => {
                    if (appIndex) setAppIndex(appIndex - 1)
                    else setStep(1)
                  })
                }}
              >
                {t('previous')}
              </button>
              <button
                type="button"
                className="primary"
                disabled={busy}
                onClick={nextEvaluation}
              >
                {busy
                  ? t('submitting')
                  : appIndex === applications.length - 1
                    ? t('submit')
                    : t('next')}
              </button>
            </div>
          </div>
        )}
        {step === 3 && (
          <section className="confirmation flow" role="status">
            <div className="success-mark" aria-hidden="true">
              ✓
            </div>
            <h1 id="stage-title" tabIndex={-1}>
              {t('successTitle')}
            </h1>
            <p>{t('successMessage')}</p>
            <a
              href="/"
              className="text-button"
              onClick={(event) => {
                event.preventDefault()
                window.location.reload()
              }}
            >
              {t('again')}
            </a>
          </section>
        )}
      </div>
      {step < 3 && <p className="session-note">{t('sessionPrivacy')}</p>}
    </div>
  )
}
