import { TIPO_LABELS } from '@/lib/types'

/**
 * Etiqueta compacta + emoji por tipo, para el TÍTULO de la card de Chat (donde
 * se lee más grande que el subtítulo). Es intencionalmente más corta que
 * TIPO_LABELS (que se usa en la ficha del sitio).
 */
const TIPO_TITULO: Record<string, { emoji: string; label: string }> = {
  Story: { emoji: '✨', label: 'Novedad' },
  'Bug Cliente': { emoji: '🔧', label: 'Fix' },
  'Bug Producto': { emoji: '🔧', label: 'Fix' },
  RAP: { emoji: '🛠️', label: 'Desarrollo a medida' },
}

export interface ChatUpdate {
  id: string
  titulo: string
  descripcion?: string | null
  tipo?: string | null
  producto?: string | null
  fecha?: string | null
  companyId?: string | null
  issueUrl?: string | null
}

function formatDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Postea una novedad a un espacio de Google Chat (incoming webhook). El equipo
 * que se une al espacio queda "suscripto". No hace nada si no hay webhook.
 * Nunca lanza: un fallo de Chat no debe romper el sync.
 */
export async function postToChat(update: ChatUpdate): Promise<boolean> {
  const webhook = process.env.CHAT_WEBHOOK_URL
  if (!webhook) return false

  // APP_URL debería venir de la env de Vercel; si falta o queda vacío, caemos al
  // dominio vivo para que el botón "Ver en el sitio" nunca desaparezca de la card.
  const base = (process.env.APP_URL || 'https://cliengo-novedades.vercel.app').replace(/\/$/, '')
  const url = `${base}/features/${update.id}`

  // El tipo va en el TÍTULO (se lee más grande); el subtítulo queda para el producto.
  const tipoTitulo = update.tipo ? TIPO_TITULO[update.tipo] : null
  const emoji = tipoTitulo?.emoji ?? '📣'
  const title = tipoTitulo
    ? `${emoji} ${tipoTitulo.label}: ${update.titulo}`
    : `${emoji} ${update.titulo}`
  const subtitle = update.producto || (update.tipo ? TIPO_LABELS[update.tipo] ?? update.tipo : null)
  const fecha = formatDate(update.fecha)

  const widgets: Record<string, unknown>[] = []
  if (update.descripcion) widgets.push({ textParagraph: { text: update.descripcion } })
  if (fecha) widgets.push({ decoratedText: { topLabel: 'En producción', text: fecha } })
  if (update.companyId) {
    widgets.push({ decoratedText: { topLabel: 'Company ID (cliente afectado)', text: `🏢 ${update.companyId}` } })
  }
  const buttons: Record<string, unknown>[] = []
  if (url) buttons.push({ text: 'Ver en el sitio', onClick: { openLink: { url } } })
  if (update.issueUrl) {
    buttons.push({ text: 'Ver en GitHub', onClick: { openLink: { url: update.issueUrl } } })
  }
  if (buttons.length) widgets.push({ buttonList: { buttons } })

  const body = {
    cardsV2: [
      {
        cardId: `product-update-${update.id}`,
        card: {
          header: {
            title,
            subtitle: subtitle || 'Novedad de producto',
          },
          sections: [{ widgets }],
        },
      },
    ],
  }

  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      console.warn(`[chat] webhook respondió ${res.status}: ${await res.text()}`)
      return false
    }
    return true
  } catch (err) {
    console.warn(`[chat] falló el post: ${err instanceof Error ? err.message : String(err)}`)
    return false
  }
}
