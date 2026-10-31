import 'dotenv/config'
import { runMaintenance } from './run-maintenance'
import { z } from 'zod'
import { getCMS } from '../src/lib/payload'
await runMaintenance(async () => {
  const env = z
    .object({
      ADMIN_EMAIL: z.email(),
      ADMIN_PASSWORD: z.string().min(16),
      ADMIN_NAME: z.string().min(1),
    })
    .parse(process.env)
  const payload = await getCMS()
  try {
    const existing = await payload.count({ collection: 'admin-users' })
    if (existing.totalDocs)
      throw new Error(
        'An administrator already exists. Use authenticated administration to add more.',
      )
    await payload.create({
      collection: 'admin-users',
      context: { bootstrap: true },
      data: {
        email: env.ADMIN_EMAIL,
        password: env.ADMIN_PASSWORD,
        name: env.ADMIN_NAME,
      },
    })
    console.log(
      'Administrator created. Remove ADMIN_PASSWORD from your environment.',
    )
  } finally {
    await payload.destroy()
  }
})
