import {
  ensureSchema,
  getExistingIds,
  createFeature,
  updateFeatureMeta,
  deleteAllFeatures,
  getFeatureByIssueNumber,
  getFeaturesMissingDescription,
  updateFeatureGenerated,
} from '@/lib/db/repository'
import { MockDataSource } from './sources/mock'
import { GitHubDataSource } from './sources/github'
import type { DataSource } from './sources/mock'
import { postToChat } from './chat'
import { generateProductUpdate } from './groq'

/**
 * Backfill quirúrgico: regenera con IA SOLO las features que quedaron sin
 * descripción (p. ej. las creadas mientras Groq estaba caído). No toca el resto,
 * no pisa metadata/estado/captura y NUNCA avisa al canal de Chat.
 */
export async function backfillDescriptions(): Promise<{
  found: number
  regenerated: number
  failed: string[]
}> {
  if (process.env.DATA_SOURCE !== 'github') {
    return { found: 0, regenerated: 0, failed: ['DATA_SOURCE no es github'] }
  }
  await ensureSchema()
  const source = new GitHubDataSource(process.env.GITHUB_TOKEN!)
  const missing = await getFeaturesMissingDescription()

  const failed: string[] = []
  let regenerated = 0
  for (const f of missing) {
    try {
      const content = await source.getIssueContent(f.id)
      if (!content) {
        failed.push(`#${f.issueNumber}: issue no encontrado en GitHub`)
        continue
      }
      // Mismo ritmo que en el create para no pasarnos del rate limit de Groq.
      await new Promise(r => setTimeout(r, 900))
      const gen = await generateProductUpdate(content.title, content.body, f.type)
      if (!gen || !gen.descripcion) {
        failed.push(`#${f.issueNumber}: Groq no devolvió descripción`)
        continue
      }
      await updateFeatureGenerated(f.id, {
        tituloAmigable: gen.titulo || undefined,
        descripcionCliente: gen.descripcion,
        aQuienAplica: gen.aQuienAplica || null,
        mensajeSugerido: gen.mensajeSugerido || null,
      })
      regenerated++
    } catch (err) {
      failed.push(`#${f.issueNumber}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  console.log(`[backfill] ${regenerated}/${missing.length} regeneradas, ${failed.length} fallidas`)
  return { found: missing.length, regenerated, failed }
}

/**
 * Postea al canal de Chat la card de UNA feature ya existente, por número de
 * issue. Sirve para comunicar a mano una novedad puntual (ej. tras un backfill
 * silencioso donde el resto no se notificó).
 */
export async function notifyIssue(
  issueNumber: number
): Promise<{ notified: boolean; error?: string }> {
  const f = await getFeatureByIssueNumber(issueNumber)
  if (!f) return { notified: false, error: `Feature del issue #${issueNumber} no encontrada` }
  const ok = await postToChat({
    id: f.id,
    titulo: f.tituloAmigable,
    descripcion: f.descripcionCliente,
    tipo: f.type,
    producto: f.producto,
    fecha: f.milestoneDate,
    companyId: f.companyId,
    issueUrl: f.issueUrl,
  })
  return { notified: ok }
}

export async function runSync(options: { reset?: boolean; silent?: boolean } = {}): Promise<{
  created: number
  updated: number
  deleted: number
  notified: number
  skipped: { excluded: number; tasks: number }
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
  const skipped = source.skipped ?? { excluded: 0, tasks: 0 }

  const errors: string[] = []
  let created = 0
  let updated = 0

  let notified = 0
  for (const item of items) {
    try {
      if (item.isNew) {
        await createFeature(item.data)
        created++
        // Aviso al canal de Google Chat (solo novedades reales; no en reset masivo
        // ni en un backfill silencioso).
        if (!options.reset && !options.silent) {
          const ok = await postToChat({
            id: item.data.id,
            titulo: item.data.tituloAmigable,
            descripcion: item.data.descripcionCliente,
            tipo: item.data.type,
            producto: item.data.producto,
            fecha: item.data.milestoneDate,
            companyId: item.data.companyId,
            issueUrl: item.data.issueUrl,
          })
          if (ok) notified++
        }
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

  console.log(
    `[sync] Done: ${created} creadas, ${updated} actualizadas, ${notified} avisadas a Chat, ` +
      `${skipped.excluded} no comunicadas, ${skipped.tasks} tareas, ${errors.length} errores`
  )
  return { created, updated, deleted, notified, skipped, errors }
}
