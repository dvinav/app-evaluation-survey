import { sqlPool } from '@/lib/database'
export const dynamic = 'force-dynamic'
export async function GET() {
  try {
    await sqlPool.query('SELECT 1 FROM survey_rate_limits LIMIT 0')
    return Response.json(
      { status: 'ok' },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503 })
  }
}
