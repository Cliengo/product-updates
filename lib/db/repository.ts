import { prisma } from './prisma'
import type { Prisma } from '../../app/generated/prisma/client'
import type { FeatureData, FaqItem, EstadoDisponibilidad } from '@/lib/types'
import type { NewFeatureData, SyncMetadata } from '@/lib/sync/types'
import { parseCfDate } from '@/lib/sync/cutoff'

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
    ]
  }

  const features = await prisma.feature.findMany({
    where,
    orderBy: { milestoneDate: 'desc' },
  })

  return features.map(f => deserialize(f))
}

/** Releases (milestones "CF DD/MM") presentes, ordenados del más nuevo al más viejo. */
export async function getReleases(): Promise<string[]> {
  const rows = await prisma.feature.findMany({
    where: { milestone: { not: null } },
    select: { milestone: true },
    distinct: ['milestone'],
  })
  const ref = process.env.PUBLISH_CF_CUTOFF || '2026-06-29'
  return rows
    .map(r => r.milestone!)
    .filter(Boolean)
    .sort((a, b) => (parseCfDate(b, ref) ?? -Infinity) - (parseCfDate(a, ref) ?? -Infinity))
}

export async function getFeatureById(id: string): Promise<FeatureData | null> {
  const feature = await prisma.feature.findUnique({ where: { id } })
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
      milestone: data.milestone ?? null,
      milestoneDate: data.milestoneDate ? new Date(data.milestoneDate) : null,
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

/** Borra todas las features (usado por el reset del sync). */
export async function deleteAllFeatures(): Promise<number> {
  const res = await prisma.feature.deleteMany({})
  return res.count
}
