import { assertOrigin, rateLimit, readSmallJSON, SurveyError } from '@/lib/http'
import { isDevelopment, surveyResponseHeaders } from '@/lib/origins'
import { persistSubmission } from '@/lib/submit'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  try {
    assertOrigin(request)
    await rateLimit(request)
    await persistSubmission(await readSmallJSON(request))
    return Response.json(
      { success: true },
      { headers: surveyResponseHeaders() },
    )
  } catch (error) {
    if (error instanceof SurveyError)
      return Response.json(
        { error: error.code },
        {
          status: error.status,
          headers: {
            ...surveyResponseHeaders(),
            ...(error.status === 429 ? { 'Retry-After': '600' } : {}),
          },
        },
      )
    // Do not log validation errors or database parameters containing participant information.
    console.error(
      'Survey submission failed; database transaction was not committed.',
    )
    return Response.json(
      { error: 'submissionFailed' },
      { status: 503, headers: surveyResponseHeaders() },
    )
  }
}

export function OPTIONS() {
  return new Response(null, {
    status: isDevelopment() ? 204 : 405,
    headers: {
      ...surveyResponseHeaders(),
      Allow: isDevelopment() ? 'POST, OPTIONS' : 'POST',
    },
  })
}
