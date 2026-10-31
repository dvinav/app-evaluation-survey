import { describe, expect, it } from 'vitest'
import { mean, median, rankings } from '../../src/lib/analytics'
import { toCSV, datasetColumns } from '../../src/lib/exports'
describe('research exports', () => {
  it('uses UTF-8 BOM, RFC-style escaping and preserves numeric ratings', () => {
    expect(
      toCSV(
        [{ question_text: 'فارسی، "نقل"\nخط', raw_rating: 7 }],
        ['question_text', 'raw_rating'],
      ),
    ).toBe('\uFEFF"question_text","raw_rating"\r\n"فارسی، ""نقل""\nخط","7"\r\n')
  })
  it('neutralizes spreadsheet formulas in text and retains negative numeric data', () =>
    expect(
      toCSV([{ text: ' =1+1', number: -1 }], ['text', 'number']),
    ).toContain('"\' =1+1","-1"'))
  it('always emits headers for empty datasets and excludes identity columns', () => {
    expect(toCSV([], datasetColumns.answers)).toContain('"raw_rating"')
    expect(JSON.stringify(datasetColumns)).not.toMatch(
      /email|first_name|surname|profile_url/,
    )
  })
})
describe('descriptive statistics', () => {
  it('handles empty, odd and even samples', () => {
    expect(mean([])).toBeNull()
    expect(median([])).toBeNull()
    expect(median([7, 1, 3])).toBe(3)
    expect(median([7, 1])).toBe(4)
  })
  const evaluation = (id: number, mode = 'general', version = 'v1') => ({
    evaluation_id: id,
    application_id: 1,
    application_name: 'App',
    questionnaire_mode: mode,
    questionnaire_version: version,
  })
  const answer = (
    id: number,
    rating: number | null,
    reverse = false,
    status = 'rated',
  ) => ({
    evaluation_id: id,
    raw_rating: rating,
    reverse_scored: reverse,
    response_status: status,
    dimension: 'usability',
  })
  it('weights respondents equally, reverses separately, and counts missing/NA', () => {
    const rows = rankings(
      [evaluation(1), evaluation(2), evaluation(3)],
      [
        answer(1, 7),
        answer(1, 1, true),
        answer(2, 1),
        answer(2, null, false, 'unanswered'),
        answer(3, null, false, 'not-applicable'),
      ],
    )
    const row = rows.find((r) => r.dimension === '')!
    expect(row.mean).toBe(4)
    expect(row.median).toBe(4)
    expect(row.count).toBe(2)
    expect(row.missing).toBe(1)
    expect(row.notApplicable).toBe(1)
    expect(row.excluded).toBe(1)
  })
  it('does not mix modes, versions or dimensions', () => {
    const rows = rankings(
      [
        evaluation(1),
        evaluation(2, 'detailed'),
        evaluation(3, 'general', 'v2'),
      ],
      [answer(1, 7), answer(2, 1), answer(3, 2)],
    )
    expect(rows).toHaveLength(6)
    expect(rows.every((r) => r.rank === 1 && r.count === 1)).toBe(true)
  })
})
