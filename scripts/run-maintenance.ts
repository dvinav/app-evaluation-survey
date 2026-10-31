export async function runMaintenance(task: () => Promise<void>) {
  let exitCode = 0
  try {
    await task()
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Maintenance failed')
    exitCode = 1
  }
  // Payload's Postgres adapter retains a reserved client after destroy(). Finite
  // CLI commands must exit explicitly, after flushing their status output.
  process.stdout.write('', () => {
    process.stderr.write('', () => process.exit(exitCode))
  })
}
