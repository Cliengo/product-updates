import type { FeatureData } from '@/lib/types'
import type { DataSource } from './mock'
import { parseComment } from '../parsers/comment'
import { generateProductUpdate } from '../groq'
import { buildTemplateComment, PRODUCT_UPDATE_HEADER } from '../template'

/**
 * Campo single-select del Project. Todo lo que llega a IN PROD se publica;
 * el equipo marca "No comunicar = Sí" en el board (antes de IN PROD) para excluir.
 */
const EXCLUDE_FIELD = 'No comunicar'
const EXCLUDE_VALUE = 'Sí'

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
          comments: { nodes: { body: string }[] }
          milestone?: { title: string; dueOn?: string }
        } | null
      }[]
    }
  }
}

export class GitHubDataSource implements DataSource {
  private token: string
  private org: string

  constructor(token: string, org = 'cliengo') {
    this.token = token
    this.org = org
  }

  async getFeatures(): Promise<FeatureData[]> {
    const [roadmap, rap] = await Promise.all([
      this.fetchFromProject('roadmap'),
      this.fetchFromProject('rap'),
    ])
    return [...roadmap, ...rap]
  }

  /** Postea un comentario en un issue vía la REST API. Requiere token con issues:write. */
  private async postComment(
    repo: 'roadmap' | 'rap',
    issueNumber: number,
    body: string
  ): Promise<void> {
    const res = await fetch(
      `https://api.github.com/repos/${this.org}/${repo}/issues/${issueNumber}/comments`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github+json',
        },
        body: JSON.stringify({ body }),
      }
    )
    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`No se pudo postear el comentario en #${issueNumber}: ${res.status} ${errText}`)
    }
    console.log(`[github] Template posteado en ${repo}#${issueNumber}`)
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

  private async fetchFromProject(repo: 'roadmap' | 'rap'): Promise<FeatureData[]> {
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
                fieldValues(first: 20) {
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
                    comments(last: 10) {
                      nodes { body }
                    }
                    milestone { title dueOn }
                  }
                }
              }
            }
          }
        }
      }
    `

    const features: FeatureData[] = []
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

        // Publicamos todo lo que está IN PROD, salvo lo marcado "No comunicar".
        if (fields['Status']?.toUpperCase() !== 'IN PROD') continue
        if (fields[EXCLUDE_FIELD] === EXCLUDE_VALUE) continue

        let commentBody = [...issue.comments.nodes]
          .reverse()
          .find(c => c.body?.includes(PRODUCT_UPDATE_HEADER))?.body

        // Sin comentario template: lo generamos con Groq, lo posteamos en el
        // issue (queda editable) y lo publicamos en esta misma corrida.
        if (!commentBody) {
          const generated = await generateProductUpdate(
            issue.title ?? '',
            issue.body ?? ''
          )
          commentBody = buildTemplateComment({
            titulo: generated?.titulo || issue.title || `Issue #${issue.number}`,
            descripcion: generated?.descripcion,
          })
          await this.postComment(repo, issue.number!, commentBody)
        }

        const parsed = parseComment(commentBody)

        if (!parsed.tituloAmigable || !parsed.estadoDisponibilidad) {
          console.warn(`[github] #${issue.number} (${repo}): ${parsed.parseErrors.join(', ')}`)
          continue
        }

        features.push({
          id: issue.id,
          issueNumber: issue.number!,
          issueUrl: issue.url!,
          repo,
          producto: fields['Producto'],
          priority: fields['Priority'],
          type: fields['Type'],
          milestone: issue.milestone?.title,
          milestoneDate: issue.milestone?.dueOn,
          githubStatus: fields['Status'],
          tituloAmigable: parsed.tituloAmigable,
          descripcionCliente: parsed.descripcionCliente,
          featureFlag: parsed.featureFlag,
          estadoDisponibilidad: parsed.estadoDisponibilidad,
          planMinimo: parsed.planMinimo,
          aQuienAplica: parsed.aQuienAplica,
          mensajeSugerido: parsed.mensajeSugerido,
          screenshotsUrl: parsed.screenshotsUrl,
          videoUrl: parsed.videoUrl,
          onePagerUrl: parsed.onePagerUrl,
          faq: parsed.faq,
          notasInternas: parsed.notasInternas,
          rawComment: commentBody,
          parseErrors: parsed.parseErrors,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          syncedAt: new Date().toISOString(),
        })
      }

      cursor = pageInfo.hasNextPage ? pageInfo.endCursor : null
    } while (cursor)

    return features
  }
}
