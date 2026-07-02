import {
  ensureSchema,
  getExistingIds,
  createFeature,
  updateFeatureMeta,
  deleteAllFeatures,
} from '@/lib/db/repository'
import { MockDataSource } from './sources/mock'
import { GitHubDataSource } from './sources/github'
import type { DataSource } from './sources/mock'

export async function runSync(options: { reset?: boolean } = {}): Promise<{
  created: number
  updated: number
  deleted: number
  errors: string[]
}> {
  const source: DataSource =
    process.env.DATA_SOURCE === 'github'
      ? new GitHubDataSource(process.env.GITHUB_TOKEN!)
      : new MockDataSource()

  await ensureSchema()

  let deleted = 0
  if (options.reset) {
    deleted = await deleteAllFeatures()
    console.log(`[sync] reset: ${deleted} features borradas`)
  }

  const existingIds = await getExistingIds()
  const items = await source.getFeatures(existingIds)

  const errors: string[] = []
  let created = 0
  let updated = 0

  for (const item of items) {
    try {
      if (item.isNew) {
        await createFeature(item.data)
        created++
      } else {
        await updateFeatureMeta(item.data)
        updated++
      }
    } catch (err) {
      const msg = `#${item.data.issueNumber}: ${err instanceof Error ? err.message : String(err)}`
      errors.push(msg)
      console.error(`[sync] Error: ${msg}`)
    }
  }

  console.log(`[sync] Done: ${created} creadas, ${updated} actualizadas, ${errors.length} errores`)
  return { created, updated, deleted, errors }
}
