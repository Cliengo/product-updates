import type { FeatureData } from '@/lib/types'
import mockData from '@/data/mock-features.json'

export interface DataSource {
  getFeatures(): Promise<FeatureData[]>
}

export class MockDataSource implements DataSource {
  async getFeatures(): Promise<FeatureData[]> {
    return mockData as FeatureData[]
  }
}
