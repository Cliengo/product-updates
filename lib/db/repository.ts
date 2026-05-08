import { prisma } from './prisma'
import type { Prisma } from '../../app/generated/prisma/client'
import type { FeatureData, FaqItem, EstadoDisponibilidad } from '@/lib/types'

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
  q?: string
}

export async function getFeatures(filters: FeatureFilters): Promise<FeatureData[]> {
  const where: Prisma.FeatureWhereInput = {}

  if (filters.estado) where.estadoDisponibilidad = filters.estado
  if (filters.producto) where.producto = filters.producto
  if (filters.priority) where.priority = filters.priority
  if (filters.tipo) where.type = filters.tipo
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
