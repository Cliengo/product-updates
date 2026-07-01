import type { FeatureData } from '@/lib/types'
import type { SyncItem } from '../types'
import mockData from '@/data/mock-features.json'

export interface DataSource {
  getFeatures(existingIds: Set<string>): Promise<SyncItem[]>
}

export class MockDataSource implements DataSource {
  async getFeatures(existingIds: Set<string>): Promise<SyncItem[]> {
    const features = mockData as unknown as FeatureData[]
    return features.map(f => {
      const meta = {
        id: f.id,
        issueNumber: f.issueNumber,
        issueUrl: f.issueUrl,
        repo: f.repo,
        producto: f.producto,
        priority: f.priority,
        type: f.type,
        milestone: f.milestone,
        milestoneDate: f.milestoneDate,
        githubStatus: f.githubStatus,
      }
      if (existingIds.has(f.id)) return { isNew: false, data: meta }
      return {
        isNew: true,
        data: {
          ...meta,
          tituloAmigable: f.tituloAmigable,
          descripcionCliente: f.descripcionCliente ?? null,
          aQuienAplica: f.aQuienAplica ?? null,
          mensajeSugerido: f.mensajeSugerido ?? null,
          screenshotsUrl: f.screenshotsUrl ?? null,
          featureFlag: f.featureFlag ?? null,
          estadoDisponibilidad: f.estadoDisponibilidad,
        },
      }
    })
  }
}
