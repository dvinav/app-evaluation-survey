import type { ExportRow } from './exports'
export type Ranking = {
  applicationId: number
  applicationName: string
  mode: string
  version: string
  dimension: string
  count: number
  excluded: number
  mean: number | null
  median: number | null
  missing: number
  notApplicable: number
  rank: number | null
}
export function mean(values: number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null
}
export function median(values: number[]) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}
export function rankings(
  evaluations: ExportRow[],
  answers: ExportRow[],
): Ranking[] {
  const byEvaluation = new Map<number, ExportRow[]>()
  for (const answer of answers) {
    const key = Number(answer.evaluation_id)
    const list = byEvaluation.get(key) || []
    list.push(answer)
    byEvaluation.set(key, list)
  }
  const groups = new Map<string, { row: Ranking; scores: number[] }>()
  for (const evaluation of evaluations) {
    const responses = byEvaluation.get(Number(evaluation.evaluation_id)) || []
    // Empty string denotes the whole instrument; named dimensions are separate scores.
    const dimensions = new Set([
      '',
      ...responses.map((r) => String(r.dimension || '')).filter(Boolean),
    ])
    for (const dimension of dimensions) {
      const relevant = dimension
        ? responses.filter((r) => r.dimension === dimension)
        : responses
      const scores = relevant
        .filter(
          (r) =>
            r.response_status === 'rated' && typeof r.raw_rating === 'number',
        )
        .map((r) =>
          r.reverse_scored ? 8 - Number(r.raw_rating) : Number(r.raw_rating),
        )
      const key = JSON.stringify([
        evaluation.application_id,
        evaluation.questionnaire_mode,
        evaluation.questionnaire_version,
        dimension,
      ])
      let group = groups.get(key)
      if (!group) {
        group = {
          row: {
            applicationId: Number(evaluation.application_id),
            applicationName: String(evaluation.application_name),
            mode: String(evaluation.questionnaire_mode),
            version: String(evaluation.questionnaire_version),
            dimension,
            count: 0,
            excluded: 0,
            mean: null,
            median: null,
            missing: 0,
            notApplicable: 0,
            rank: null,
          },
          scores: [],
        }
        groups.set(key, group)
      }
      const score = mean(scores)
      if (score !== null) group.scores.push(score)
      else group.row.excluded++
      group.row.missing += relevant.filter(
        (r) => r.response_status === 'unanswered',
      ).length
      group.row.notApplicable += relevant.filter(
        (r) => r.response_status === 'not-applicable',
      ).length
    }
  }
  const result = [...groups.values()].map(({ row, scores }) => ({
    ...row,
    count: scores.length,
    mean: mean(scores),
    median: median(scores),
  }))
  for (const row of result)
    if (row.mean !== null)
      row.rank =
        1 +
        result.filter(
          (other) =>
            other.mode === row.mode &&
            other.version === row.version &&
            other.dimension === row.dimension &&
            other.mean !== null &&
            other.mean > row.mean!,
        ).length
  return result.sort(
    (a, b) =>
      a.mode.localeCompare(b.mode) ||
      a.version.localeCompare(b.version) ||
      a.dimension.localeCompare(b.dimension) ||
      (a.rank ?? Infinity) - (b.rank ?? Infinity) ||
      a.applicationId - b.applicationId,
  )
}
