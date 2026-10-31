'use client'
import { useRef } from 'react'
import { flushSync } from 'react-dom'

export function useSurveyTransition() {
  const active = useRef<ViewTransition | null>(null)
  return (direction: 'forward' | 'back', update: () => void) => {
    active.current?.skipTransition()
    const commit = () => {
      flushSync(update)
      document
        .querySelector('.research-heading')
        ?.scrollIntoView({ block: 'start', behavior: 'instant' })
    }
    if (
      !document.startViewTransition ||
      matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      commit()
      return
    }
    document.documentElement.dataset.surveyDirection = direction
    const transition = document.startViewTransition(commit)
    active.current = transition
    // A newer navigation may deliberately skip an in-flight transition.
    void transition.ready.catch(() => {})
    void transition.finished
      .catch(() => {})
      .finally(() => {
        if (active.current === transition) active.current = null
      })
  }
}
