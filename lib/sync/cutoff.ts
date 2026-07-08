/**
 * Corte de publicación por Code Freeze (CF).
 *
 * Los milestones del roadmap se nombran "CF DD/MM" (ej: "CF 29/06", "CF 11/5",
 * a veces con doble espacio o sin cero). El dueOn casi nunca está cargado, así
 * que la fecha del corte se parsea del TÍTULO del milestone.
 *
 * Se publica solo lo cuyo CF es >= PUBLISH_CF_CUTOFF. Items sin milestone o con
 * un milestone que no matchea el patrón CF quedan excluidos.
 */

const DEFAULT_CUTOFF = '2026-06-29' // CF 29/06

/** Parsea "CF DD/MM" (o "CF DD/MM/YYYY") a un timestamp, infiriendo el año. */
export function parseCfDate(title: string | undefined | null, cutoffISO: string): number | null {
  if (!title) return null
  const m = title.match(/(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?/)
  if (!m) return null

  const day = Number(m[1])
  const month = Number(m[2]) // 1-12
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const cutoff = new Date(cutoffISO + 'T00:00:00Z')
  let year = m[3]
    ? Number(m[3].length === 2 ? '20' + m[3] : m[3])
    : cutoff.getUTCFullYear()

  // Sin año explícito: si con el año del corte la fecha cae >180 días ANTES del
  // corte, en realidad es del año siguiente (rollover dic→ene).
  if (!m[3]) {
    let d = Date.UTC(year, month - 1, day)
    if (d < cutoff.getTime() - 180 * 86400000) {
      year += 1
      d = Date.UTC(year, month - 1, day)
    }
    return d
  }
  return Date.UTC(year, month - 1, day)
}

/**
 * true si el item debe publicarse según el corte de CF.
 *
 * Prioridad: 1) fecha del milestone CF; 2) si no hay milestone CF válido (típico
 * en bugs que salen a prod sin milestone), la fecha de producción (`fallbackISO`
 * = In Prod At / closedAt). Los ítems previos al corte siguen excluidos, así que
 * esto no reintroduce el histórico.
 */
export function passesCutoff(
  milestoneTitle: string | undefined | null,
  fallbackISO?: string | null
): boolean {
  const cutoffISO = process.env.PUBLISH_CF_CUTOFF || DEFAULT_CUTOFF
  const cutoff = new Date(cutoffISO + 'T00:00:00Z').getTime()

  const cf = parseCfDate(milestoneTitle, cutoffISO)
  if (cf !== null) return cf >= cutoff

  if (fallbackISO) {
    const d = new Date(fallbackISO).getTime()
    if (!Number.isNaN(d)) return d >= cutoff
  }
  return false
}
