import { z } from 'zod'
import { authorizedAdmin } from '@/lib/admin'
import { researchData, filterSchema } from '@/lib/research-data'
import { datasetColumns, toCSV } from '@/lib/exports'
export const runtime = 'nodejs'
export async function GET(request: Request) {
  if (!(await authorizedAdmin(request)))
    return new Response(null, { status: 403 })
  const query = Object.fromEntries(new URL(request.url).searchParams)
  const parsed = filterSchema.safeParse(query)
  const dataset = z
    .enum([
      'participants',
      'evaluations',
      'answers',
      'companies',
      'applications',
      'generalQuestions',
      'detailedQuestions',
    ])
    .safeParse(query.dataset)
  const format = z.enum(['csv', 'json']).safeParse(query.format)
  if (!parsed.success || !dataset.success || !format.success)
    return new Response(null, { status: 400 })
  const rows = (await researchData(parsed.data))[dataset.data]
  const body =
    format.data === 'json'
      ? JSON.stringify(rows)
      : toCSV(rows, datasetColumns[dataset.data])
  return new Response(body, {
    headers: {
      'Content-Type':
        format.data === 'json'
          ? 'application/json; charset=utf-8'
          : 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${dataset.data}.${format.data}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
