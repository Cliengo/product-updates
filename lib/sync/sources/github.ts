import type { DataSource } from './mock'
import type { SyncItem, SyncMetadata } from '../types'
import { normalizeIssueType } from '@/lib/types'
import { generateProductUpdate } from '../groq'
import { passesCutoff } from '../cutoff'

/**
 * Campo single-select del Project. Todo lo que llega a IN PROD se publica;
 * el equipo marca "No comunicar = Sí" en el board (antes de IN PROD) para excluir.
 */
const EXCLUDE_FIELD = 'No comunicar'
const EXCLUDE_VALUE = 'Sí'

/** issueTypes nativos que nunca se publican (tareas internas). */
const EXCLUDED_TYPES = ['task', 'tarea']

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

  constructor(token: string, org = 'cliengo') {
    this.token = token
    this.org = org
  }

  async getFeatures(existingIds: Set<string>): Promise<SyncItem[]> {
    const [roadmap, rap] = await Promise.all([
      this.fetchFromProject('roadmap', existingIds),
      this.fetchFromProject('rap', existingIds),
    ])
    return [...roadmap, ...rap]
  }

  private async graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    })
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
    const json = await res.json()
    if (json.errors) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`)
    return json.data
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
        if (fields[EXCLUDE_FIELD] === EXCLUDE_VALUE) continue

        // Nunca publicar tareas internas (issueType nativo "Task"/"Tarea"):
        // son trabajo operativo (crear configs, retroactividades), no novedades.
        if (EXCLUDED_TYPES.includes((issue.issueType?.name ?? '').trim().toLowerCase())) continue

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
