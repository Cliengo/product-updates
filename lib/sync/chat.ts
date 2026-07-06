import { TIPO_LABELS } from '@/lib/types'

export interface ChatUpdate {
  id: string
  titulo: string
  descripcion?: string | null
  tipo?: string | null
  producto?: string | null
  fecha?: string | null
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

  const base = (process.env.APP_URL || '').replace(/\/$/, '')
  const url = base ? `${base}/features/${update.id}` : undefined

  const tipoLabel = update.tipo ? TIPO_LABELS[update.tipo] ?? update.tipo : null
  const subtitle = [tipoLabel, update.producto].filter(Boolean).join(' · ')
  const fecha = formatDate(update.fecha)

  const widgets: Record<string, unknown>[] = []
  if (update.descripcion) widgets.push({ textParagraph: { text: update.descripcion } })
  if (fecha) widgets.push({ decoratedText: { topLabel: 'En producción', text: fecha } })
  if (url) {
    widgets.push({
      buttonList: {
        buttons: [{ text: 'Ver en el sitio', onClick: { openLink: { url } } }],
      },
    })
  }

  const body = {
    cardsV2: [
      {
        cardId: `product-update-${update.id}`,
        card: {
          header: {
            title: `📣 ${update.titulo}`,
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
