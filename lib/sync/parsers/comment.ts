import type { FaqItem, EstadoDisponibilidad } from '@/lib/types'

const VALID_ESTADOS: EstadoDisponibilidad[] = [
  'rolled-out',
  'flag',
  'beta-privada',
  'beta-publica',
  'on-demand',
  'en-desarrollo',
  'deprecated',
]

function extractSection(text: string, heading: string): string | null {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`###\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=\\n###|$)`, 'i')
  const match = text.match(regex)
  if (!match) return null
  const content = match[1].trim()
  return content || null
}

function parseFaq(faqText: string): FaqItem[] {
  return faqText
    .split('\n')
    .filter(l => l.startsWith('-'))
    .map(line => {
      const content = line.replace(/^-\s*/, '')
      const colonIdx = content.indexOf(':')
      if (colonIdx === -1) return { pregunta: content.trim(), respuesta: '' }
      return {
        pregunta: content.slice(0, colonIdx).trim(),
        respuesta: content.slice(colonIdx + 1).trim(),
      }
    })
    .filter(f => f.pregunta)
}

function extractAssetLink(text: string, label: string): string | null {
  const regex = new RegExp(`${label}[:\\s]+\\[([^\\]]+)\\]`, 'i')
  const match = text.match(regex)
  if (!match || match[1] === 'link') return null
  return match[1].trim()
}

export interface ParseResult {
  tituloAmigable: string | null
  descripcionCliente: string | null
  featureFlag: string | null
  estadoDisponibilidad: EstadoDisponibilidad | null
  planMinimo: string | null
  aQuienAplica: string | null
  mensajeSugerido: string | null
  screenshotsUrl: string | null
  videoUrl: string | null
  onePagerUrl: string | null
  faq: FaqItem[]
  notasInternas: string | null
  parseErrors: string[]
}

export function parseComment(commentBody: string): ParseResult {
  const errors: string[] = []

  if (!commentBody.includes('## 📣 Product Update')) {
    return {
      tituloAmigable: null,
      descripcionCliente: null,
      featureFlag: null,
      estadoDisponibilidad: null,
      planMinimo: null,
      aQuienAplica: null,
      mensajeSugerido: null,
      screenshotsUrl: null,
      videoUrl: null,
      onePagerUrl: null,
      faq: [],
      notasInternas: null,
      parseErrors: ['Comentario no tiene la estructura de Product Update'],
    }
  }

  const titulo = extractSection(commentBody, 'Título amigable')
  if (!titulo) errors.push('Falta: Título amigable')

  const descripcion = extractSection(commentBody, 'Descripción para cliente')
  if (!descripcion) errors.push('Falta: Descripción para cliente')

  const flagSection = extractSection(commentBody, 'Feature flag (LaunchDarkly)')
  let featureFlag: string | null = null
  if (flagSection) {
    const match = flagSection.match(/flag:\s*(.+)/i)
    featureFlag = match ? match[1].trim() : flagSection
  }

  const estadoRaw = extractSection(commentBody, 'Estado actual')
  let estadoDisponibilidad: EstadoDisponibilidad | null = null
  if (estadoRaw) {
    const normalized = estadoRaw.toLowerCase().trim() as EstadoDisponibilidad
    if (VALID_ESTADOS.includes(normalized)) {
      estadoDisponibilidad = normalized
    } else {
      errors.push(`Estado inválido: "${estadoRaw}". Válidos: ${VALID_ESTADOS.join(', ')}`)
    }
  } else {
    errors.push('Falta: Estado actual')
  }

  const planMinimo = extractSection(commentBody, 'Plan / Hub mínimo requerido')
  const aQuienAplica = extractSection(commentBody, 'A quién aplica')
  const mensajeSugerido = extractSection(commentBody, 'Mensaje sugerido para cliente')
  const notasInternas = extractSection(commentBody, 'Notas internas')

  const assetsSection = extractSection(commentBody, 'Assets')
  const screenshotsUrl = assetsSection ? extractAssetLink(assetsSection, 'Screenshots?') : null
  const videoUrl = assetsSection ? extractAssetLink(assetsSection, 'Video\\s*demo') : null
  const onePagerUrl = assetsSection ? extractAssetLink(assetsSection, 'One-?pager') : null

  const faqSection = extractSection(commentBody, 'FAQ interna')
  const faq = parseFaq(faqSection ?? '')

  return {
    tituloAmigable: titulo,
    descripcionCliente: descripcion,
    featureFlag,
    estadoDisponibilidad,
    planMinimo,
    aQuienAplica,
    mensajeSugerido,
    screenshotsUrl,
    videoUrl,
    onePagerUrl,
    faq,
    notasInternas,
    parseErrors: errors,
  }
}
