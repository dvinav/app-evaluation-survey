'use client'
import { useEffect, useState } from 'react'
import { createTranslator } from 'next-intl'
import type { Ranking } from '@/lib/analytics'
import messages from '../../messages/fa.json' with { type: 'json' }
import './research-dashboard.css'
const t = createTranslator({ locale: 'fa', messages, namespace: 'admin' })
const number = new Intl.NumberFormat('fa', { maximumFractionDigits: 2 })
export function ResearchDashboard() {
  const [rows, setRows] = useState<Ranking[] | null>(null)
  const [query, setQuery] = useState(''),
    [error, setError] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/research/results?${query}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Results unavailable')
        setRows((await response.json()) as Ranking[])
        setError(false)
      })
      .catch((failure: unknown) => {
        if (!(failure instanceof DOMException && failure.name === 'AbortError'))
          setError(true)
      })
    return () => controller.abort()
  }, [query])
  return (
    <section className="research-dashboard" dir="rtl">
      <h2>{t('title')}</h2>
      <p>{t('description')}</p>
      <form
        className="research-filters"
        onSubmit={(event) => {
          event.preventDefault()
          setRows(null)
          setError(false)
          const data = new FormData(event.currentTarget)
          setQuery(
            new URLSearchParams(
              [...data.entries()].map(([key, value]) => [key, String(value)]),
            ).toString(),
          )
        }}
      >
        <label>
          {t('from')}
          <input name="from" type="date" />
        </label>
        <label>
          {t('to')}
          <input name="to" type="date" />
        </label>
        <label>
          {t('mode')}
          <select name="mode">
            <option value="">{t('allModes')}</option>
            <option value="general">{t('general')}</option>
            <option value="detailed">{t('detailed')}</option>
          </select>
        </label>
        <button type="submit">{t('filter')}</button>
      </form>
      {error ? (
        <p role="alert">{t('error')}</p>
      ) : rows === null ? (
        <p role="status">{messages.common.loading}</p>
      ) : rows.length === 0 ? (
        <p>{t('noResults')}</p>
      ) : (
        <div className="research-table-scroll">
          <table>
            <thead>
              <tr>
                {(
                  [
                    'rank',
                    'application',
                    'mode',
                    'version',
                    'dimension',
                    'count',
                    'mean',
                    'median',
                    'missing',
                    'na',
                    'excluded',
                  ] as const
                ).map((key) => (
                  <th key={key} scope="col">
                    {t(key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.applicationId}-${row.mode}-${row.version}-${row.dimension}`}
                >
                  <td>{row.rank === null ? '—' : number.format(row.rank)}</td>
                  <th scope="row">
                    {row.applicationName}
                    {row.count < 10 && <small>{t('smallSample')}</small>}
                  </th>
                  <td>
                    {row.mode === 'general' ? t('general') : t('detailed')}
                  </td>
                  <td title={row.version}>
                    <code>{row.version.slice(0, 8)}</code>
                  </td>
                  <td>{row.dimension || t('wholeInstrument')}</td>
                  <td>{number.format(row.count)}</td>
                  <td>{row.mean === null ? '—' : number.format(row.mean)}</td>
                  <td>
                    {row.median === null ? '—' : number.format(row.median)}
                  </td>
                  <td>{number.format(row.missing)}</td>
                  <td>{number.format(row.notApplicable)}</td>
                  <td>{number.format(row.excluded)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h3>{t('exports')}</h3>
      <form
        className="research-filters"
        action="/api/research/export"
        method="get"
      >
        {Array.from(new URLSearchParams(query)).map(([key, value]) => (
          <input type="hidden" key={key} name={key} value={value} />
        ))}
        <label>
          {t('dataset')}
          <select name="dataset">
            {(
              [
                'participants',
                'evaluations',
                'answers',
                'companies',
                'applications',
                'generalQuestions',
                'detailedQuestions',
              ] as const
            ).map((key) => (
              <option key={key} value={key}>
                {t(key)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('format')}
          <select name="format">
            <option value="csv">{t('csv')}</option>
            <option value="json">{t('json')}</option>
          </select>
        </label>
        <button type="submit">{t('export')}</button>
      </form>
    </section>
  )
}
