import { upsertFeature } from '@/lib/db/repository'
import { MockDataSource } from './sources/mock'
import { GitHubDataSource } from './sources/github'
import type { DataSource } from './sources/mock'

export async function runSync(): Promise<{ synced: number; errors: string[] }> {
  const source: DataSource =
    process.env.DATA_SOURCE === 'github'
      ? new GitHubDataSource(process.env.GITHUB_TOKEN!)
      : new MockDataSource()

  const features = await source.getFeatures()
  const errors: string[] = []
  let synced = 0

  for (const feature of features) {
    try {
      await upsertFeature(feature)
      if (feature.parseErrors && feature.parseErrors.length > 0) {
        console.warn(
          `[sync] #${feature.issueNumber} (${feature.repo}) warnings: ${feature.parseErrors.join(', ')}`
        )
      }
      synced++
    } catch (err) {
      const msg = `#${feature.issueNumber}: ${err instanceof Error ? err.message : String(err)}`
      errors.push(msg)
      console.error(`[sync] Error persisting feature: ${msg}`)
    }
  }

  console.log(`[sync] Done: ${synced} synced, ${errors.length} errors`)
  return { synced, errors }
}
