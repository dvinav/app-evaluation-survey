import * as rateLimits from './20261031_140000_rate_limits'
import * as migration_20261031_134919_initial_schema from './20261031_134919_initial_schema'

export const migrations = [
  {
    up: migration_20261031_134919_initial_schema.up,
    down: migration_20261031_134919_initial_schema.down,
    name: '20261031_134919_initial_schema',
  },
  {
    up: rateLimits.up,
    down: rateLimits.down,
    name: '20261031_140000_rate_limits',
  },
]
