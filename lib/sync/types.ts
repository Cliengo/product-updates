import type { FeatureData } from '@/lib/types'

/**
 * Metadatos que vienen de GitHub y se actualizan en CADA sync (no son editables
 * a mano). `milestoneDate` guarda la fecha de "In Prod At" (puesta en producción).
 */
export interface SyncMetadata {
  id: string
  issueNumber: number
  issueUrl: string
  repo: string
  producto?: string | null
  priority?: string | null
  type?: string | null
  milestone?: string | null
  milestoneDate?: string | null
  githubStatus?: string | null
}

/** Feature nueva: metadatos + contenido generado por IA (se crea una sola vez). */
export type NewFeatureData = SyncMetadata &
  Pick<
    FeatureData,
    | 'tituloAmigable'
    | 'descripcionCliente'
    | 'aQuienAplica'
    | 'mensajeSugerido'
    | 'screenshotsUrl'
    | 'estadoDisponibilidad'
    | 'featureFlag'
  >

/**
 * Item devuelto por el sync. Si `isNew`, trae el contenido completo a crear;
 * si no, solo metadatos a actualizar (nunca pisa el texto ya editado).
 */
export type SyncItem =
  | { isNew: true; data: NewFeatureData }
  | { isNew: false; data: SyncMetadata }
