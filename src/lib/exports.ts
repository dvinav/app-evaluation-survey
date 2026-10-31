export type ExportValue = string | number | boolean | null
export type ExportRow = Record<string, ExportValue>
export const datasetColumns = {
  participants: [
    'submission_id',
    'submitted_at',
    'background',
    'questionnaire_mode',
    'questionnaire_version',
    'consent_version',
    'consented_at',
  ],
  evaluations: [
    'evaluation_id',
    'submission_id',
    'application_id',
    'application_name',
    'company_id',
    'company_name',
    'questionnaire_mode',
    'questionnaire_version',
    'evaluated_at',
    'question_count',
  ],
  answers: [
    'submission_id',
    'evaluation_id',
    'application_id',
    'company_id',
    'questionnaire_mode',
    'questionnaire_version',
    'question_id',
    'question_text',
    'question_version',
    'dimension',
    'required',
    'raw_rating',
    'response_status',
    'not_applicable',
    'reverse_scored',
    'scale_min',
    'scale_max',
    'answered_at',
  ],
  companies: [
    'company_id',
    'company_name',
    'website',
    'participation_status',
    'interview_agreement',
    'interview_progress',
  ],
  applications: [
    'application_id',
    'application_name',
    'company_id',
    'url',
    'category',
    'active',
    'public',
    'display_order',
  ],
  generalQuestions: [
    'question_id',
    'question_text',
    'question_version',
    'description',
    'dimension',
    'reverse_scored',
    'required',
    'allow_na',
    'active',
    'display_order',
  ],
  detailedQuestions: [
    'question_id',
    'question_text',
    'question_version',
    'description',
    'dimension',
    'reverse_scored',
    'required',
    'allow_na',
    'active',
    'display_order',
  ],
} as const
export type Dataset = keyof typeof datasetColumns
export function spreadsheetSafe(value: string) {
  return /^[\s]*[=+\-@]/u.test(value) || /^[\t\r\n]/u.test(value)
    ? `'${value}`
    : value
}
export function toCSV(rows: ExportRow[], columns: readonly string[]) {
  const cell = (value: ExportValue | undefined) => {
    let text = value == null ? '' : String(value)
    // Neutralize spreadsheet formula injection only for text; keep numeric scores numeric.
    if (typeof value === 'string') text = spreadsheetSafe(text)
    return `"${text.replaceAll('"', '""')}"`
  }
  return (
    '\uFEFF' +
    [
      columns.map(cell).join(','),
      ...rows.map((row) =>
        columns.map((column) => cell(row[column])).join(','),
      ),
    ].join('\r\n') +
    '\r\n'
  )
}
