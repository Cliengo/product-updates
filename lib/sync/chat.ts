import {
  TIPO_LABELS,
  DISPONIBILIDAD_LABELS,
  type Disponibilidad,
} from '@/lib/types'

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

/**
 * Cómo se ve el alcance dentro de la card. OJO: la card NO se edita después, así
 * que esto es una foto del momento del anuncio — por eso el texto aclara que el
 * estado actual vive en el sitio (que sí se actualiza solo en cada sync).
 */
const DISPONIBILIDAD_CHAT: Record<Disponibilidad, { emoji: string; detalle: string }> = {
  parcial: {
    emoji: '🟡',
    detalle: 'Puede no estar activo para todas las cuentas todavía · estado actual en el sitio',
  },
  todos: { emoji: '🟢', detalle: 'Lo tienen todas las cuentas' },
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
  disponibilidad?: Disponibilidad | null
}

function formatDate(dateStr: string | Date | null | undefined): string | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Los textos de las cards admiten un subset de HTML: escapamos lo que insertamos. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function appBase(): string {
  // APP_URL debería venir de la env de Vercel; si falta o queda vacío, caemos al
  // dominio vivo para que el botón "Ver en el sitio" nunca desaparezca de la card.
  return (process.env.APP_URL || 'https://cliengo-novedades.vercel.app').replace(/\/$/, '')
}

/**
 * Arma la card de una novedad. Se usa tanto al postearla como al EDITARLA
 * cuando cambia el alcance (IN PROD → ROLLED OUT), así las dos versiones de la
 * card se mantienen idénticas salvo la fila de disponibilidad.
 */
function buildCard(update: ChatUpdate): Record<string, unknown> {
  const url = `${appBase()}/features/${update.id}`

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
  if (update.disponibilidad) {
    const d = DISPONIBILIDAD_CHAT[update.disponibilidad]
    widgets.push({
      decoratedText: {
        topLabel: 'Disponibilidad al anunciarse',
        text: `${d.emoji} <b>${DISPONIBILIDAD_LABELS[update.disponibilidad]}</b>`,
        bottomLabel: d.detalle,
      },
    })
  }
  if (update.companyId) {
    widgets.push({
      decoratedText: { topLabel: 'Company ID (cliente afectado)', text: `🏢 ${update.companyId}` },
    })
  }
  const buttons: Record<string, unknown>[] = []
  buttons.push({ text: 'Ver en el sitio', onClick: { openLink: { url } } })
  if (update.issueUrl) {
    buttons.push({ text: 'Ver en GitHub', onClick: { openLink: { url: update.issueUrl } } })
  }
  widgets.push({ buttonList: { buttons } })

  return {
    cardId: `product-update-${update.id}`,
    card: {
      header: { title, subtitle: subtitle || 'Novedad de producto' },
      sections: [{ widgets }],
    },
  }
}

/**
 * Postea un cuerpo cardsV2 al webhook. `name` es el id del mensaje creado
 * (spaces/XXX/messages/YYY), que Chat devuelve en la respuesta: es lo que
 * permite editar esa card más adelante. Puede venir null aunque el post salga
 * bien; en ese caso solo perdemos la posibilidad de editarla.
 */
async function postCards(
  cards: Record<string, unknown>[]
): Promise<{ ok: boolean; name: string | null }> {
  const webhook = process.env.CHAT_WEBHOOK_URL
  if (!webhook) return { ok: false, name: null }

  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ cardsV2: cards }),
    })
    if (!res.ok) {
      console.warn(`[chat] webhook respondió ${res.status}: ${await res.text()}`)
      return { ok: false, name: null }
    }
    const json = (await res.json().catch(() => null)) as { name?: string } | null
    return { ok: true, name: json?.name ?? null }
  } catch (err) {
    console.warn(`[chat] falló el post: ${err instanceof Error ? err.message : String(err)}`)
    return { ok: false, name: null }
  }
}

/**
 * Postea una novedad a un espacio de Google Chat (incoming webhook). El equipo
 * que se une al espacio queda "suscripto". No hace nada si no hay webhook.
 * Nunca lanza: un fallo de Chat no debe romper el sync.
 *
 * La card no se edita después: cuando la feature termina su rollout, el cambio
 * se ve en el sitio y se anuncia en el resumen semanal.
 */
export async function postToChat(update: ChatUpdate): Promise<boolean> {
  const { ok } = await postCards([buildCard(update)])
  return ok
}

export interface DigestItem {
  id: string
  titulo: string
  tipo?: string | null
  producto?: string | null
  rolledOutAt?: string | Date | null
}

/**
 * Resumen semanal: UN solo mensaje al canal con todo lo que terminó su rollout
 * en la semana. Es el único aviso de este cambio (las cards individuales se
 * editan en silencio). No postea nada si la lista viene vacía.
 */
export async function postWeeklyDigest(
  items: DigestItem[],
  periodo: { desde: Date; hasta: Date }
): Promise<{ ok: boolean; posted: number }> {
  if (!items.length) return { ok: false, posted: 0 }

  const base = appBase()
  const rango = `${periodo.desde.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
  })} al ${periodo.hasta.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`

  const MAX = 15
  const visibles = items.slice(0, MAX)

  const widgets: Record<string, unknown>[] = [
    {
      textParagraph: {
        text:
          `Estas novedades terminaron su rollout: <b>ya las tienen todas las cuentas</b>. ` +
          `Antes estaban en producción con disponibilidad parcial.`,
      },
    },
  ]

  // Cada título es un hipervínculo a su ficha. Va como un solo textParagraph con
  // <a href> (Chat lo renderiza como link visible y clickeable) en vez de filas
  // sueltas, que se ven clickeables recién al pasar el mouse.
  const lineas = visibles.map(item => {
    const emoji = item.tipo ? TIPO_TITULO[item.tipo]?.emoji ?? '•' : '•'
    const producto = item.producto ? ` · ${escapeHtml(item.producto)}` : ''
    return `${emoji} <a href="${base}/features/${item.id}">${escapeHtml(item.titulo)}</a>${producto}`
  })

  if (items.length > visibles.length) {
    lineas.push(`<i>…y ${items.length - visibles.length} más en el sitio.</i>`)
  }

  widgets.push({ textParagraph: { text: lineas.join('<br>') } })

  widgets.push({
    buttonList: {
      buttons: [
        {
          text: 'Ver todas',
          onClick: { openLink: { url: `${base}/?disponibilidad=todos` } },
        },
      ],
    },
  })

  const card = {
    cardId: 'weekly-digest',
    card: {
      header: {
        title: `🟢 Ya disponibles para todos (${items.length})`,
        subtitle: `Semana del ${rango}`,
      },
      sections: [{ widgets }],
    },
  }

  const { ok } = await postCards([card])
  return { ok, posted: ok ? items.length : 0 }
}
