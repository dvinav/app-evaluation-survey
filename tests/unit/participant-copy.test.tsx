import { renderToStaticMarkup } from 'react-dom/server'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it } from 'vitest'
import { ParticipantForm } from '../../src/components/ParticipantForm'
import messages from '../../messages/fa.json' with { type: 'json' }
import { participant, snapshot } from '../fixtures'
function renderCounts(general: number, detailed: number) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="fa" messages={messages}>
      <ParticipantForm
        initial={participant}
        consent={snapshot.consent}
        questionCounts={{ general, detailed }}
        onContinue={() => {}}
      />
    </NextIntlClientProvider>,
  )
}
describe('questionnaire workload explanation', () => {
  it('shows actual per-application counts and the extra workload of detailed mode', () => {
    const html = renderCounts(5, 30)
    for (const text of [
      '۵',
      '۳۰',
      '۲۵',
      'پرسش بیشتر',
      'زمان بیشتری',
      'جایگزین',
    ])
      expect(html).toContain(text)
  })
  it('does not falsely claim more questions when both instruments have equal counts', () => {
    const html = renderCounts(2, 2)
    expect(html).toContain('این دو مجموعه با هم ترکیب نمی‌شوند')
    expect(html).not.toContain('زمان بیشتری')
  })
})
