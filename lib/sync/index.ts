import {
  ensureSchema,
  getExistingMeta,
  createFeature,
  updateFeatureMeta,
  deleteAllFeatures,
  getFeatureByIssueNumber,
  getFeaturesMissingDescription,
  updateFeatureGenerated,
  getRolledOutSince,
} from '@/lib/db/repository'
import { MockDataSource } from './sources/mock'
import { GitHubDataSource } from './sources/github'
import type { DataSource } from './sources/mock'
import { postToChat, postWeeklyDigest } from './chat'
import { generateProductUpdate } from './groq'

/**
 * Ventana de promocion silenciosa (one-time, agosto 2026).
 *
 * Al automatizar el pase de los Bug cliente de IN PROD a ROLLED OUT en el board
 * quedaron 55 bugs viejos para mover de golpe. Sin esto, el sync los leeria como
 * 55 promociones del dia y el resumen del lunes los listaria a todos.
 *
 * Mientras estemos antes de esta fecha, una promocion NO estampa `rolledOutAt`:
 * el sitio los muestra igual como disponibles para todos (eso lo maneja
 * `disponibilidad`), pero al no tener fecha quedan fuera de la ventana del
 * resumen semanal. No se les inventa una fecha porque no sabemos cuando pasaron
 * a estar disponibles para todas las cuentas.
 *
 * Es a prueba de carreras: no importa que corrida del cron horario los agarre.
 * Se desactiva sola al pasar la fecha, no hay que volver a tocar nada.
 */
const PROMO_SILENCIOSA_HASTA = new Date('2026-08-23T00:00:00Z')

/**
 * Backfill quirúrgico: regenera con IA SOLO las features que quedaron sin
 * descripción (p. ej. las creadas mientras Groq estaba caído). No toca el resto,
 * no pisa metadata/estado/captura y NUNCA avisa al canal de Chat.
 *
 * Con `issueNumber` regenera esa feature aunque YA tenga descripción: sirve para
 * corregir un texto que salió mal (ej. un fix con el eje "Antes/Ahora" invertido)
 * sin editarlo a mano en el sitio.
 */
export async function backfillDescriptions(issueNumber?: number): Promise<{
  found: number
  regenerated: number
  failed: string[]
}> {
  if (process.env.DATA_SOURCE !== 'github') {
    return { found: 0, regenerated: 0, failed: ['DATA_SOURCE no es github'] }
  }
  await ensureSchema()
  const source = new GitHubDataSource(process.env.GITHUB_TOKEN!)
  let missing: { id: string; issueNumber: number; repo: string; type: string | null }[]
  if (issueNumber) {
    const f = await getFeatureByIssueNumber(issueNumber)
    if (!f) return { found: 0, regenerated: 0, failed: [`#${issueNumber} no está en el sitio`] }
    missing = [{ id: f.id, issueNumber: f.issueNumber, repo: f.repo, type: f.type ?? null }]
  } else {
    missing = await getFeaturesMissingDescription()
  }

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
    disponibilidad: f.disponibilidad,
  })
  return { notified: ok }
}

export async function runSync(options: { reset?: boolean; silent?: boolean } = {}): Promise<{
  created: number
  updated: number
  deleted: number
  notified: number
  /** Features que pasaron de "rollout parcial" a "disponible para todos" en esta corrida. */
  promoted: number
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

  // Estado previo de cada feature: sirve para saber cuáles son nuevas y para
  // detectar el cambio de alcance (rollout parcial → disponible para todos).
  const existing = await getExistingMeta()
  const items = await source.getFeatures(new Set(existing.keys()))
  const skipped = source.skipped ?? { excluded: 0, tasks: 0 }

  const errors: string[] = []
  let created = 0
  let updated = 0

  let notified = 0
  let promoted = 0
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
            disponibilidad: item.data.disponibilidad,
          })
          if (ok) notified++
        }
      } else {
        const prev = existing.get(item.data.id)
        const ahora = item.data.disponibilidad ?? null
        const antes = prev?.disponibilidad ?? null

        // Transición real: estaba en rollout parcial y ahora lo tienen todos.
        const esPromocion = antes === 'parcial' && ahora === 'todos'
        // Primera vez que vemos el alcance de una feature vieja (la columna se
        // llenó recién): estampamos la fecha de prod como aproximación, sin
        // tratarlo como novedad (no edita cards ni entra al resumen semanal).
        const esBackfill = antes === null && ahora === 'todos' && !prev?.rolledOutAt

        // Ver PROMO_SILENCIOSA_HASTA: durante la ventana la promocion no estampa
        // fecha, asi que no entra al resumen semanal.
        const promoSilenciosa = esPromocion && new Date() < PROMO_SILENCIOSA_HASTA

        let rolledOutAt: Date | undefined
        if (esPromocion && !promoSilenciosa) rolledOutAt = new Date()
        else if (esBackfill) {
          rolledOutAt = item.data.milestoneDate ? new Date(item.data.milestoneDate) : new Date()
        }

        await updateFeatureMeta(item.data, { rolledOutAt })
        updated++

        // El sitio se actualiza solo (lee `disponibilidad`); al canal no se le
        // avisa acá: el aviso es el resumen semanal, que agrupa todo en un mensaje.
        if (esPromocion) {
          promoted++
          console.log(
            `[sync] #${item.data.issueNumber} pasó a disponible para todos${promoSilenciosa ? ' (silencioso: no entra al resumen)' : ''}: ${prev?.tituloAmigable ?? ''}`
          )
        }
      }
    } catch (err) {
      const msg = `#${item.data.issueNumber}: ${err instanceof Error ? err.message : String(err)}`
      errors.push(msg)
      console.error(`[sync] Error: ${msg}`)
    }
  }

  console.log(
    `[sync] Done: ${created} creadas, ${updated} actualizadas, ${notified} avisadas a Chat, ` +
      `${promoted} pasaron a disponible para todos, ` +
      `${skipped.excluded} no comunicadas, ${skipped.tasks} tareas, ${errors.length} errores`
  )
  return { created, updated, deleted, notified, promoted, skipped, errors }
}

/**
 * Resumen SEMANAL al canal: un único mensaje con todo lo que pasó a estar
 * disponible para todos en los últimos `days` días. Es el único aviso de este
 * cambio (las cards individuales se editan en silencio, y Chat no re-notifica
 * una edición). Si no hubo nada, no postea.
 */
export async function runWeeklyDigest(
  options: { days?: number; dry?: boolean } = {}
): Promise<{ found: number; posted: number; dry: boolean; items: string[] }> {
  const days = options.days ?? 7
  const hasta = new Date()
  const desde = new Date(hasta.getTime() - days * 24 * 60 * 60 * 1000)

  await ensureSchema()
  const features = await getRolledOutSince(desde)
  const items = features.map(f => ({
    id: f.id,
    titulo: f.tituloAmigable,
    tipo: f.type,
    producto: f.producto,
    rolledOutAt: f.rolledOutAt,
  }))

  if (options.dry) {
    console.log(`[digest] dry-run: ${items.length} features en los últimos ${days} días`)
    return { found: items.length, posted: 0, dry: true, items: items.map(i => i.titulo) }
  }

  const { posted } = await postWeeklyDigest(items, { desde, hasta })
  console.log(`[digest] ${items.length} encontradas, ${posted} posteadas al canal`)
  return { found: items.length, posted, dry: false, items: items.map(i => i.titulo) }
}
