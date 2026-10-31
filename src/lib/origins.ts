export function isDevelopment() {
  return process.env.NODE_ENV === 'development'
}
export function allowsSurveyOrigin(origin: string | null) {
  return (
    isDevelopment() ||
    origin === (process.env.SERVER_URL || 'http://localhost:3000')
  )
}
export function surveyResponseHeaders(): HeadersInit {
  return {
    'Cache-Control': 'no-store',
    ...(isDevelopment()
      ? {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      : {}),
  }
}
export function publicMediaURL(value: string) {
  if (!value) return ''
  const base = process.env.SERVER_URL || 'http://localhost:3000'
  const url = new URL(value, base)
  // Uploaded icons use local Payload storage, including files uploaded before a host change.
  return url.pathname.startsWith('/api/media/file/') ||
    url.origin === new URL(base).origin
    ? `${url.pathname}${url.search}`
    : value
}
