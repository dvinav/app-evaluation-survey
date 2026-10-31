import { authorizedAdmin } from '@/lib/admin'
import { researchData, filterSchema } from '@/lib/research-data'
import { rankings } from '@/lib/analytics'
export async function GET(request: Request) {
  if (!(await authorizedAdmin(request)))
    return new Response(null, { status: 403 })
  const filters = filterSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  )
  if (!filters.success) return new Response(null, { status: 400 })
  const data = await researchData(filters.data)
  return Response.json(rankings(data.evaluations, data.answers), {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
