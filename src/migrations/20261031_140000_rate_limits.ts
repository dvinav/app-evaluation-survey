import {
  sql,
  type MigrateUpArgs,
  type MigrateDownArgs,
} from '@payloadcms/db-postgres'
export async function up({ db }: MigrateUpArgs) {
  await db.execute(
    sql`CREATE TABLE survey_rate_limits (bucket varchar(64) PRIMARY KEY, window_start bigint NOT NULL, count integer NOT NULL CHECK (count > 0)); CREATE INDEX survey_rate_limits_window_idx ON survey_rate_limits (window_start);`,
  )
}
export async function down({ db }: MigrateDownArgs) {
  await db.execute(sql`DROP TABLE survey_rate_limits;`)
}
