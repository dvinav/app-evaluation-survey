import { Pool } from 'pg'
export const sqlPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 4,
})
