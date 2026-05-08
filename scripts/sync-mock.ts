import 'dotenv/config'
import { runSync } from '@/lib/sync'

async function main() {
  console.log('[sync:mock] Running with MockDataSource...')
  const result = await runSync()
  console.log(`[sync:mock] Synced: ${result.synced} features`)
  if (result.errors.length > 0) {
    console.error('[sync:mock] Errors:')
    result.errors.forEach(e => console.error(' -', e))
    process.exit(1)
  }
}

main().catch(err => {
  console.error('[sync:mock] Fatal error:', err)
  process.exit(1)
})
