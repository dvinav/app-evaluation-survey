import { getCMS } from './payload'
export async function authorizedAdmin(request: Request) {
  const payload = await getCMS()
  const { user } = await payload.auth({ headers: request.headers })
  return user?.collection === 'admin-users'
}
