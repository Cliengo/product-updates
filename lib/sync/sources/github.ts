import type { FeatureData } from '@/lib/types'
import type { DataSource } from './mock'
import { parseComment } from '../parsers/comment'

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
      const data = await this.graphql<{ node: { items: { pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: unknown[] } } }>(
        QUERY,
        { projectId, cursor }
      )
      const { nodes, pageInfo } = data.node.items

      for (const item of nodes as { fieldValues: { nodes: { name?: string; text?: string; date?: string; field?: { name: string } }[] }; content: { id?: string; number?: number; url?: string; comments: { nodes: { body: string }[] }; milestone?: { title: string; dueOn?: string } } | null }[]) {
        const issue = item.content
        if (!issue?.id) continue

        const fields: Record<string, string> = {}
        for (const fv of item.fieldValues.nodes) {
          if (fv?.field?.name) {
            const val = fv.name ?? fv.text ?? fv.date
            if (val) fields[fv.field.name] = val
          }
        }

        // Only process IN PROD items
        if (fields['Status'] !== 'In Prod') continue

        const updateComment = [...issue.comments.nodes]
          .reverse()
          .find(c => c.body?.includes('## 📣 Product Update'))

        if (!updateComment) continue

        const parsed = parseComment(updateComment.body)

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
          rawComment: updateComment.body,
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
