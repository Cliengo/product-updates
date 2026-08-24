import type { DataSource } from './mock'
import type { SyncItem, SyncMetadata } from '../types'
import { normalizeIssueType, disponibilidadFromStatus } from '@/lib/types'
import { generateProductUpdate } from '../groq'
import { passesCutoff } from '../cutoff'

const MAX_REINTENTOS_GH = 3
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Backoff exponencial con tope, respetando `retry-after` si GitHub lo manda. */
async function esperarAntesDeReintentar(
  intento: number,
  retryAfter: string | null,
  motivo: string
): Promise<void> {
  const segundos = Number(retryAfter)
  const waitMs = Math.min(segundos > 0 ? segundos * 1000 : 2000 * 2 ** intento, 8000)
  console.warn(
    `[github] ${motivo}, reintento ${intento + 1}/${MAX_REINTENTOS_GH} en ${waitMs}ms`
  )
  await sleep(waitMs)
}


/**
 * Campo single-select del Project que deja un item afuera. Todo lo que llega a
 * IN PROD se publica; el equipo marca el campo en el board (antes de IN PROD)
 * para excluir algo puntual.
 *
 * Se aceptan varios pares campo/valor: el nuevo ("Difusión = No comunicar") y el
 * viejo ("No comunicar = Sí"). Así renombrar el campo en el board no apaga la
 * exclusión en silencio y manda trabajo interno al canal de ~50 personas.
 */
const EXCLUDE_RULES = [
  { field: 'difusion', value: 'no comunicar' },
  { field: 'no comunicar', value: 'si' },
]

/** issueTypes nativos que nunca se publican (tareas internas). */
const EXCLUDED_TYPES = ['task', 'tarea']

/** Para comparar nombres/valores del board: sin acentos, sin espacios de más, minúsculas. */
function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
}

/** ¿El board marcó este item como "no comunicar"? */
function isExcluded(fields: Record<string, string>): boolean {
  return Object.entries(fields).some(([name, value]) =>
    EXCLUDE_RULES.some(r => r.field === norm(name) && r.value === norm(value))
  )
}

interface ProjectItemsResponse {
  node: {
    items: {
      pageInfo: { hasNextPage: boolean; endCursor: string }
      nodes: {
        fieldValues: { nodes: { name?: string; text?: string; date?: string; field?: { name: string } }[] }
        content: {
          id?: string
          number?: number
          url?: string
          title?: string
          body?: string
          closedAt?: string
          issueType?: { name: string } | null
          milestone?: { title: string; dueOn?: string }
          comments?: { nodes: { body: string }[] }
        } | null
      }[]
    }
  }
}

/** Quita prefijos tipo "[Story] " / "[Bug Producto] " del título (para el fallback). */
function stripTag(title: string | undefined): string {
  return (title ?? '').replace(/^\s*(\[[^\]]+\]\s*)+/, '').trim()
}

/** Primer ObjectId (24 hex) que aparezca en un texto. */
function firstObjectId(text: string | null | undefined): string | null {
  if (!text) return null
  const m = text.match(/[0-9a-f]{24}/i)
  return m ? m[0].toLowerCase() : null
}

/**
 * Company ID del cliente afectado (roadmap). Prioridad:
 * 1) sección "### CompanyId Prod" del body,
 * 2) patrón "company id: <ObjectId>" en body o comentarios (así también aparece
 *    en stories donde queda suelto). Se busca etiquetado para NO tomar el WebsiteId.
 */
function extractCompanyId(body: string | undefined, comments: string[]): string | null {
  const section = body?.match(/###\s+CompanyId Prod\s*\n([\s\S]*?)(?=\n###|$)/i)
  const secId = firstObjectId(section?.[1])
  if (secId) return secId

  const labeled = /company[\s_-]*id[:\s#]*\**\s*([0-9a-f]{24})/i
  for (const text of [body ?? '', ...comments]) {
    const m = text.match(labeled)
    if (m) return m[1].toLowerCase()
  }
  return null
}

/** Primera imagen del cuerpo del issue (markdown o <img>), como sugerencia de captura. */
function firstImage(body: string | undefined): string | null {
  if (!body) return null
  const md = body.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/)
  if (md) return md[1]
  const html = body.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i)
  if (html) return html[1]
  return null
}

export class GitHubDataSource implements DataSource {
  private token: string
  private org: string

  /**
   * Cuántos items lanzados quedaron afuera en la última corrida y por qué.
   * Se expone para que el sync lo devuelva: excluir es una decisión que conviene
   * ver en el log del workflow, no que pase invisible.
   */
  skipped = { excluded: 0, tasks: 0 }

  constructor(token: string, org = 'cliengo') {
    this.token = token
    this.org = org
  }

  /**
   * Título y cuerpo de un issue por su node id (para regenerar contenido de una
   * feature existente sin volver a recorrer todo el Project). Null si no existe.
   */
  async getIssueContent(nodeId: string): Promise<{ title: string; body: string } | null> {
    const QUERY = `
      query($id: ID!) {
        node(id: $id) {
          ... on Issue { title body }
        }
      }
    `
    const data = await this.graphql<{ node: { title?: string; body?: string } | null }>(QUERY, {
      id: nodeId,
    })
    if (!data.node) return null
    return { title: data.node.title ?? '', body: data.node.body ?? '' }
  }

  async getFeatures(existingIds: Set<string>): Promise<SyncItem[]> {
    this.skipped = { excluded: 0, tasks: 0 }
    const [roadmap, rap] = await Promise.all([
      this.fetchFromProject('roadmap', existingIds),
      this.fetchFromProject('rap', existingIds),
    ])
    console.log(
      `[github] Salteados: ${this.skipped.excluded} marcados "no comunicar", ${this.skipped.tasks} de tipo Task`
    )
    return [...roadmap, ...rap]
  }

  /**
   * Reintentos ante errores transitorios de la API de GitHub.
   *
   * La API tira 502/503 esporadicos y sin esto un solo blip mata la corrida
   * entera: `/api/sync` devuelve 500 y el workflow queda en rojo. Con el cron
   * horario se cura solo en la corrida siguiente, pero si el blip cae justo
   * antes del digest del lunes, el resumen de esa semana sale incompleto.
   * Es el mismo `withRetry` que ya tienen los workflows del board.
   *
   * Se reintenta SOLO lo transitorio a nivel transporte: 5xx, 429, errores de
   * red, y 403 unicamente si trae `retry-after` (asi lo marca GitHub el rate
   * limit secundario; un 403 pelado es token invalido y reintentarlo no sirve).
   * Los `errors` del body de GraphQL NO se reintentan: son errores logicos de
   * la query y volverian a fallar igual.
   *
   * Es seguro porque todas las llamadas de este archivo son queries de lectura.
   * Si algun dia se agrega una mutation, revisar la idempotencia antes de que
   * pase por aca.
   *
   * Los topes (4 intentos, espera <= 8s) estan atados al `maxDuration = 300` de
   * /api/sync: en el peor caso una llamada suma ~14s, que entra holgado incluso
   * sumado al ritmo de 900ms entre llamadas a Groq.
   */
  private async graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    let ultimoError = ''

    for (let intento = 0; intento <= MAX_REINTENTOS_GH; intento++) {
      let res: Response
      try {
        res = await fetch('https://api.github.com/graphql', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query, variables }),
        })
      } catch (err) {
        // Error de red (ECONNRESET, socket hang up, DNS): tambien es transitorio.
        ultimoError = err instanceof Error ? err.message : String(err)
        if (intento === MAX_REINTENTOS_GH) break
        await esperarAntesDeReintentar(intento, null, ultimoError)
        continue
      }

      if (res.ok) {
        const json = await res.json()
        if (json.errors) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`)
        return json.data
      }

      const retryAfter = res.headers.get('retry-after')
      const transitorio = res.status >= 500 || res.status === 429 || (res.status === 403 && retryAfter)
      ultimoError = `GitHub API error: ${res.status}`
      if (!transitorio || intento === MAX_REINTENTOS_GH) throw new Error(ultimoError)

      await esperarAntesDeReintentar(intento, retryAfter, String(res.status))
    }

    throw new Error(`GitHub API error: ${ultimoError}`)
  }

  private async fetchFromProject(
    repo: 'roadmap' | 'rap',
    existingIds: Set<string>
  ): Promise<SyncItem[]> {
    const projectId =
      repo === 'roadmap'
        ? process.env.GITHUB_PROJECT_ID_ROADMAP
        : process.env.GITHUB_PROJECT_ID_RAP

    if (!projectId) {
      console.warn(`[github] Missing env: GITHUB_PROJECT_ID_${repo.toUpperCase()}`)
      return []
    }

    const QUERY = `
      query($projectId: ID!, $cursor: String) {
        node(id: $projectId) {
          ... on ProjectV2 {
            items(first: 100, after: $cursor) {
              pageInfo { hasNextPage endCursor }
              nodes {
                fieldValues(first: 30) {
                  nodes {
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      field { ... on ProjectV2FieldCommon { name } }
                    }
                    ... on ProjectV2ItemFieldTextValue {
                      text
                      field { ... on ProjectV2FieldCommon { name } }
                    }
                    ... on ProjectV2ItemFieldDateValue {
                      date
                      field { ... on ProjectV2FieldCommon { name } }
                    }
                  }
                }
                content {
                  ... on Issue {
                    id
                    number
                    url
                    title
                    body
                    closedAt
                    issueType { name }
                    milestone { title dueOn }
                    comments(last: 30) { nodes { body } }
                  }
                }
              }
            }
          }
        }
      }
    `

    const items: SyncItem[] = []
    let cursor: string | null = null

    do {
      const data: ProjectItemsResponse = await this.graphql<ProjectItemsResponse>(
        QUERY,
        { projectId, cursor }
      )
      const { nodes, pageInfo } = data.node.items

      for (const item of nodes) {
        const issue = item.content
        if (!issue?.id) continue

        const fields: Record<string, string> = {}
        for (const fv of item.fieldValues.nodes) {
          if (fv?.field?.name) {
            const val = fv.name ?? fv.text ?? fv.date
            if (val) fields[fv.field.name] = val
          }
        }

        // Estado que dispara la publicación: roadmap → IN PROD o ROLLED OUT (los
        // dos estados de "lanzado"); RAP → Productizado. Aceptar ambos cierra el
        // agujero de la transición rápida IN PROD → ROLLED OUT entre corridas del
        // cron: la clave de dedup es el id del issue, así que no duplica.
        const isRap = repo === 'rap'
        const publishStatuses = isRap ? ['PRODUCTIZADO'] : ['IN PROD', 'ROLLED OUT']
        if (!publishStatuses.includes(fields['Status']?.toUpperCase() ?? '')) continue
        if (isExcluded(fields)) {
          this.skipped.excluded++
          continue
        }

        // Nunca publicar tareas internas (issueType nativo "Task"/"Tarea"):
        // son trabajo operativo (crear configs, retroactividades), no novedades.
        if (EXCLUDED_TYPES.includes(norm(issue.issueType?.name ?? ''))) {
          this.skipped.tasks++
          continue
        }

        // Fecha "En producción":
        // - roadmap: "In Prod At" → cierre → release del milestone
        // - RAP: "Productizado At" (campo del board) → cierre → (estampa al crear)
        const prodDate = isRap
          ? fields['Productizado At'] || issue.closedAt || null
          : fields['In Prod At'] || issue.closedAt || issue.milestone?.dueOn || null

        // Corte por Code Freeze: solo roadmap. Con milestone CF válido se usa ese;
        // sin milestone (típico en bugs) se cae a la fecha de prod para no perderlos.
        if (!isRap && !passesCutoff(issue.milestone?.title, prodDate)) continue

        // Company ID: RAP tiene campo propio; roadmap se busca en body + comentarios.
        const commentBodies = issue.comments?.nodes.map(n => n.body) ?? []
        const companyId = isRap
          ? firstObjectId(fields['Company ID'])
          : extractCompanyId(issue.body, commentBodies)

        const meta: SyncMetadata = {
          id: issue.id,
          issueNumber: issue.number!,
          issueUrl: issue.url!,
          repo,
          producto: fields['Producto'],
          priority: fields['Priority'],
          type: normalizeIssueType(issue.issueType?.name) || (isRap ? 'RAP' : null),
          companyId,
          milestone: issue.milestone?.title,
          milestoneDate: prodDate,
          githubStatus: fields['Status'],
          // IN PROD = está en prod pero puede no estar activo para todas las cuentas;
          // ROLLED OUT / Productizado = lo tienen todos. Se recalcula en cada sync.
          disponibilidad: disponibilidadFromStatus(fields['Status']),
        }

        // Existente: solo actualizamos metadatos, nunca regeneramos ni pisamos ediciones.
        if (existingIds.has(issue.id)) {
          items.push({ isNew: false, data: meta })
          continue
        }

        // RAP sin fecha de cierre: estampamos la fecha en que lo vemos productizado.
        const createdDate = prodDate || (isRap ? new Date().toISOString() : null)

        // Nueva: generamos el contenido con Groq (fallback al título del issue).
        // Ritmo entre llamadas para no pasarnos del límite de tokens/minuto de Groq.
        await new Promise(r => setTimeout(r, 900))
        const generated = await generateProductUpdate(issue.title ?? '', issue.body ?? '', meta.type)
        items.push({
          isNew: true,
          data: {
            ...meta,
            milestoneDate: createdDate,
            tituloAmigable: generated?.titulo || stripTag(issue.title) || `Issue #${issue.number}`,
            descripcionCliente: generated?.descripcion || null,
            aQuienAplica: generated?.aQuienAplica || null,
            mensajeSugerido: generated?.mensajeSugerido || null,
            screenshotsUrl: firstImage(issue.body),
            featureFlag: null,
            estadoDisponibilidad: 'rolled-out',
          },
        })
      }

      cursor = pageInfo.hasNextPage ? pageInfo.endCursor : null
    } while (cursor)

    return items
  }
}
