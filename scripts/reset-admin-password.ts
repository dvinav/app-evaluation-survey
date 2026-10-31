import 'dotenv/config'
import { runMaintenance } from './run-maintenance'
import { z } from 'zod'
import { getCMS } from '../src/lib/payload'
await runMaintenance(async () => {
  const env = z
    .object({ ADMIN_EMAIL: z.email(), ADMIN_PASSWORD: z.string().min(16) })
    .parse(process.env)
  const payload = await getCMS()
  try {
    const user = (
      await payload.find({
        collection: 'admin-users',
        where: { email: { equals: env.ADMIN_EMAIL } },
        limit: 1,
      })
    ).docs[0]
    if (!user) throw new Error('Administrator not found')
    await payload.update({
      collection: 'admin-users',
      id: user.id,
      context: { bootstrap: true },
      data: { password: env.ADMIN_PASSWORD, loginAttempts: 0, lockUntil: null },
    })
    console.log(
      'Administrator password reset. Remove ADMIN_PASSWORD from your environment.',
    )
  } finally {
    await payload.destroy()
  }
})
