export type EstadoDisponibilidad =
  | 'rolled-out'
  | 'flag'
  | 'beta-privada'
  | 'beta-publica'
  | 'on-demand'
  | 'en-desarrollo'
  | 'deprecated'

export type TipoIssue = 'Story' | 'Bug Cliente' | 'Bug Producto' | 'RAP'
export type Priority = 'Alta' | 'Media' | 'Baja'

export interface FaqItem {
  pregunta: string
  respuesta: string
}

export interface FeatureData {
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
  tituloAmigable: string
  descripcionCliente?: string | null
  featureFlag?: string | null
  estadoDisponibilidad: EstadoDisponibilidad
  planMinimo?: string | null
  aQuienAplica?: string | null
  mensajeSugerido?: string | null
  screenshotsUrl?: string | null
  videoUrl?: string | null
  onePagerUrl?: string | null
  faq?: FaqItem[] | null
  notasInternas?: string | null
  rawComment?: string | null
  parseErrors?: string[] | null
  createdAt: string
  updatedAt: string
  syncedAt: string
}

export const TIPO_LABELS: Record<string, string> = {
  Story: 'Feature/Mejora',
  'Bug Cliente': 'Fix (reporte cliente)',
  'Bug Producto': 'Fix interno',
  RAP: 'Desarrollo a medida',
}

/**
 * El issueType nativo de GitHub llega con capitalización variable
 * ("Bug producto", "Bug cliente"). Lo normalizamos a las claves canónicas
 * que usan TIPO_LABELS / TypeBadge.
 */
export function normalizeIssueType(raw: string | null | undefined): string | null {
  if (!raw) return null
  switch (raw.trim().toLowerCase()) {
    case 'story':
      return 'Story'
    case 'bug cliente':
      return 'Bug Cliente'
    case 'bug producto':
      return 'Bug Producto'
    case 'rap':
      return 'RAP'
    default:
      return raw.trim()
  }
}

export const ESTADO_LABELS: Record<EstadoDisponibilidad, string> = {
  'rolled-out': 'Disponible',
  flag: 'Feature flag',
  'beta-privada': 'Beta privada',
  'beta-publica': 'Beta pública',
  'on-demand': 'On-demand',
  'en-desarrollo': 'En desarrollo',
  deprecated: 'Deprecado',
}

export const PRODUCTOS = [
  'Chatbot / IA',
  'Inbox',
  'Pricing',
  'WhatsApp',
  'MobileApp',
  'CRM / Contacts',
  'HSM Campaigns',
  'Reports',
  'Automations',
  'Interno',
  'Lia',
  'Google Ads / Meta Ads',
  'Widget Web',
  'Integraciones',
  'Usuarios y Equipos',
  'Configuración',
  'RAP',
] as const

export const ESTADOS = [
  'rolled-out',
  'flag',
  'beta-privada',
  'beta-publica',
  'on-demand',
  'en-desarrollo',
  'deprecated',
] as const satisfies EstadoDisponibilidad[]

export const PRIORIDADES = ['Alta', 'Media', 'Baja'] as const
export const TIPOS = ['Story', 'Bug Cliente', 'Bug Producto', 'RAP'] as const
