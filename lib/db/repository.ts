import { prisma } from './prisma'
import type { Prisma } from '../../app/generated/prisma/client'
import type { FeatureData, FaqItem, EstadoDisponibilidad } from '@/lib/types'
import type { NewFeatureData, SyncMetadata } from '@/lib/sync/types'
import { parseCfDate } from '@/lib/sync/cutoff'
import { releaseLabel } from '@/lib/utils'

function deserialize(raw: Awaited<ReturnType<typeof prisma.feature.findFirst>>): FeatureData {
  if (!raw) throw new Error('Feature not found')
  return {
    ...raw,
    milestoneDate: raw.milestoneDate?.toISOString() ?? null,
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
    syncedAt: raw.syncedAt.toISOString(),
    estadoDisponibilidad: raw.estadoDisponibilidad as EstadoDisponibilidad,
    faq: raw.faq ? (JSON.parse(raw.faq) as FaqItem[]) : [],
    parseErrors: raw.parseErrors ? (JSON.parse(raw.parseErrors) as string[]) : [],
  }
}

export interface FeatureFilters {
  estado?: string
  producto?: string
  priority?: string
  tipo?: string
  release?: string
  q?: string
}

export async function getFeatures(filters: FeatureFilters): Promise<FeatureData[]> {
  const where: Prisma.FeatureWhereInput = {}

  if (filters.estado) where.estadoDisponibilidad = filters.estado
  if (filters.producto) where.producto = filters.producto
  if (filters.priority) where.priority = filters.priority
  if (filters.tipo) where.type = filters.tipo
  if (filters.release) where.milestone = filters.release
  if (filters.q) {
    where.OR = [
      { tituloAmigable: { contains: filters.q } },
      { descripcionCliente: { contains: filters.q } },
      { producto: { contains: filters.q } },
      { companyId: { contains: filters.q } },
    ]
  }

  const features = await prisma.feature.findMany({
    where,
    orderBy: { milestoneDate: 'desc' },
  })

  return features.map(f => deserialize(f))
}

/**
 * Releases presentes, del más nuevo al más viejo. `value` = milestone ("CF 29/06"),
 * `label` = con año real ("CF 29/06/2026"), tomado de la fecha de producción.
 */
export async function getReleases(): Promise<{ value: string; label: string }[]> {
  const rows = await prisma.feature.findMany({
    where: { milestone: { not: null } },
    select: { milestone: true, milestoneDate: true },
    orderBy: { milestoneDate: 'desc' },
  })
  const ref = process.env.PUBLISH_CF_CUTOFF || '2026-06-29'
  const seen = new Map<string, string>()
  for (const r of rows) {
    const m = r.milestone
    if (!m || seen.has(m)) continue
    seen.set(m, releaseLabel(m, r.milestoneDate ? r.milestoneDate.toISOString() : null))
  }
  return [...seen.keys()]
    .sort((a, b) => (parseCfDate(b, ref) ?? -Infinity) - (parseCfDate(a, ref) ?? -Infinity))
    .map(value => ({ value, label: seen.get(value)! }))
}

export async function getFeatureById(id: string): Promise<FeatureData | null> {
  const feature = await prisma.feature.findUnique({ where: { id } })
  if (!feature) return null
  return deserialize(feature)
}

/** Busca una feature por el número de issue (para notificar una novedad puntual). */
export async function getFeatureByIssueNumber(issueNumber: number): Promise<FeatureData | null> {
  const feature = await prisma.feature.findFirst({ where: { issueNumber } })
  if (!feature) return null
  return deserialize(feature)
}

export async function upsertFeature(data: Omit<FeatureData, 'createdAt' | 'updatedAt' | 'syncedAt'>): Promise<void> {
  const payload = {
    issueNumber: data.issueNumber,
    issueUrl: data.issueUrl,
    repo: data.repo,
    producto: data.producto ?? null,
    priority: data.priority ?? null,
    type: data.type ?? null,
    companyId: data.companyId ?? null,
    milestone: data.milestone ?? null,
    milestoneDate: data.milestoneDate ? new Date(data.milestoneDate) : null,
    githubStatus: data.githubStatus ?? null,
    tituloAmigable: data.tituloAmigable,
    descripcionCliente: data.descripcionCliente ?? null,
    featureFlag: data.featureFlag ?? null,
    estadoDisponibilidad: data.estadoDisponibilidad,
    planMinimo: data.planMinimo ?? null,
    aQuienAplica: data.aQuienAplica ?? null,
    mensajeSugerido: data.mensajeSugerido ?? null,
    screenshotsUrl: data.screenshotsUrl ?? null,
    videoUrl: data.videoUrl ?? null,
    onePagerUrl: data.onePagerUrl ?? null,
    faq: data.faq ? JSON.stringify(data.faq) : null,
    notasInternas: data.notasInternas ?? null,
    rawComment: data.rawComment ?? null,
    parseErrors: data.parseErrors ? JSON.stringify(data.parseErrors) : null,
    syncedAt: new Date(),
  }

  await prisma.feature.upsert({
    where: { id: data.id },
    update: payload,
    create: { id: data.id, ...payload },
  })
}

/**
 * Asegura columnas agregadas después del deploy inicial (idempotente).
 * Evita depender de `prisma db push` en el build (riesgoso con conexiones pooled).
 */
export async function ensureSchema(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "Feature" ADD COLUMN IF NOT EXISTS "companyId" TEXT'
  )
}

/** IDs de todas las features ya persistidas (para saber cuáles son nuevas en el sync). */
export async function getExistingIds(): Promise<Set<string>> {
  const rows = await prisma.feature.findMany({ select: { id: true } })
  return new Set(rows.map(r => r.id))
}

/** Crea una feature nueva con el contenido generado por IA. Idempotente por id. */
export async function createFeature(data: NewFeatureData): Promise<void> {
  const payload = {
    issueNumber: data.issueNumber,
    issueUrl: data.issueUrl,
    repo: data.repo,
    producto: data.producto ?? null,
    priority: data.priority ?? null,
    type: data.type ?? null,
    companyId: data.companyId ?? null,
    milestone: data.milestone ?? null,
    milestoneDate: data.milestoneDate ? new Date(data.milestoneDate) : null,
    githubStatus: data.githubStatus ?? null,
    tituloAmigable: data.tituloAmigable,
    descripcionCliente: data.descripcionCliente ?? null,
    aQuienAplica: data.aQuienAplica ?? null,
    mensajeSugerido: data.mensajeSugerido ?? null,
    featureFlag: data.featureFlag ?? null,
    screenshotsUrl: data.screenshotsUrl ?? null,
    estadoDisponibilidad: data.estadoDisponibilidad,
    syncedAt: new Date(),
  }
  await prisma.feature.upsert({
    where: { id: data.id },
    update: {}, // ya existe → no la tocamos acá (la maneja updateFeatureMeta)
    create: { id: data.id, ...payload },
  })
}

/** Actualiza SOLO los metadatos que vienen de GitHub. Nunca pisa el texto editado. */
export async function updateFeatureMeta(data: SyncMetadata): Promise<void> {
  await prisma.feature.update({
    where: { id: data.id },
    data: {
      issueUrl: data.issueUrl,
      producto: data.producto ?? null,
      priority: data.priority ?? null,
      type: data.type ?? null,
      companyId: data.companyId ?? null,
      milestone: data.milestone ?? null,
      // Si no hay fecha nueva, NO la pisamos (preserva la fecha estampada, ej. RAP abierto).
      milestoneDate: data.milestoneDate ? new Date(data.milestoneDate) : undefined,
      githubStatus: data.githubStatus ?? null,
      syncedAt: new Date(),
    },
  })
}

export interface EditableContent {
  tituloAmigable: string
  descripcionCliente?: string | null
  aQuienAplica?: string | null
  mensajeSugerido?: string | null
  featureFlag?: string | null
  screenshotsUrl?: string | null
  estadoDisponibilidad: EstadoDisponibilidad
}

/** Guarda las ediciones hechas a mano en el admin. */
export async function updateFeatureContent(id: string, data: EditableContent): Promise<void> {
  await prisma.feature.update({
    where: { id },
    data: {
      tituloAmigable: data.tituloAmigable,
      descripcionCliente: data.descripcionCliente ?? null,
      aQuienAplica: data.aQuienAplica ?? null,
      mensajeSugerido: data.mensajeSugerido ?? null,
      featureFlag: data.featureFlag ?? null,
      screenshotsUrl: data.screenshotsUrl ?? null,
      estadoDisponibilidad: data.estadoDisponibilidad,
    },
  })
}

/**
 * Features cuyo contenido generado por IA quedó sin descripción (típico cuando
 * Groq falló y se cayó al fallback de solo-título). Para el backfill quirúrgico.
 */
export async function getFeaturesMissingDescription(): Promise<
  { id: string; issueNumber: number; repo: string; type: string | null }[]
> {
  return prisma.feature.findMany({
    where: { OR: [{ descripcionCliente: null }, { descripcionCliente: '' }] },
    select: { id: true, issueNumber: true, repo: true, type: true },
    orderBy: { milestoneDate: 'desc' },
  })
}

/**
 * Actualiza SOLO los campos generados por IA (título/descripción/a quién aplica/
 * mensaje sugerido), sin tocar metadata, estado, captura ni flag. Usado por el
 * backfill: el título solo se pisa si viene uno nuevo no vacío.
 */
export async function updateFeatureGenerated(
  id: string,
  data: {
    tituloAmigable?: string
    descripcionCliente: string
    aQuienAplica?: string | null
    mensajeSugerido?: string | null
  }
): Promise<void> {
  await prisma.feature.update({
    where: { id },
    data: {
      ...(data.tituloAmigable ? { tituloAmigable: data.tituloAmigable } : {}),
      descripcionCliente: data.descripcionCliente,
      aQuienAplica: data.aQuienAplica ?? null,
      mensajeSugerido: data.mensajeSugerido ?? null,
      syncedAt: new Date(),
    },
  })
}

/** Borra todas las features (usado por el reset del sync). */
export async function deleteAllFeatures(): Promise<number> {
  const res = await prisma.feature.deleteMany({})
  return res.count
}
