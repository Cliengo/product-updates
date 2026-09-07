/**
 * Solapa Delivery: qué le falta a cada feature antes de poder anunciarlo, venderlo
 * o cobrarlo.
 *
 * PRINCIPIO: los requisitos NO se tipean, se DERIVAN de campos que ya existen.
 * "¿Tiene documentación?" es un campo lleno o vacío, no una opinión. Agregar tres
 * campos nuevos para marcar a mano lo que ya se puede leer de los datos garantiza
 * que se llenen dos semanas y después nadie los toque.
 *
 * Los dos ejes del board (Status y Alcance) dicen DÓNDE está y A QUIÉN le llega.
 * Esto es la tercera pregunta: QUÉ FALTA. Ver `docs/RUNBOOK.md` en cliengo/roadmap.
 */

/** Qué se necesita para considerar cumplido cada requisito. */
export type EstadoRequisito =
  /** No corresponde para este tipo de ítem (un fix interno no necesita one-pager). */
  | 'no-aplica'
  /** Corresponde y está completo. */
  | 'cumplido'
  /** Corresponde y falta algo. */
  | 'pendiente'
  /** Corresponde, pero hoy no hay forma de verificarlo. Ver `chargebee` abajo. */
  | 'sin-verificar'

export interface Requisito {
  estado: EstadoRequisito
  /** Qué piezas faltan, por nombre. Un "pendiente" sin detalle no es accionable. */
  faltan: string[]
  /** Desde cuándo lo vemos cumplido. Null si se cumplió antes de que midiéramos. */
  desde?: string | null
}

/** Los datos que necesita esta solapa. Subconjunto de `FeatureData`. */
export interface DeliveryInput {
  type?: string | null
  producto?: string | null
  tituloAmigable: string
  descripcionCliente?: string | null
  aQuienAplica?: string | null
  mensajeSugerido?: string | null
  onePagerUrl?: string | null
  videoUrl?: string | null
  screenshotsUrl?: string | null
  planMinimo?: string | null
  instructivoAt?: string | Date | null
  materialAt?: string | Date | null
}

const lleno = (v: string | null | undefined): boolean => Boolean(v && v.trim())

/**
 * Un ítem "de cara al cliente" es el que alguien podría tener que explicar o vender.
 * Los internos y las correcciones no necesitan material: pedírselo llenaría la lista
 * de rojos que nadie va a resolver, y una lista así se ignora en tres semanas.
 */
export function esDeCaraAlCliente(type?: string | null, producto?: string | null): boolean {
  const t = (type ?? '').trim().toLowerCase()
  const p = (producto ?? '').trim().toLowerCase()
  return (t === 'story' || t === 'epic') && p !== 'interno'
}

/**
 * Si toca facturación. Es una SUGERENCIA POR REGLA, no un dato: nadie marcó estos
 * ítems como "requiere Chargebee" en ningún lado. Se muestra como sugerencia y así
 * está etiquetado en la UI.
 */
export function tocaFacturacion(
  type?: string | null,
  producto?: string | null,
  titulo?: string | null
): boolean {
  if ((producto ?? '').trim().toLowerCase() === 'pricing') return true
  if ((type ?? '').trim().toLowerCase() === 'epic') return true
  return /cobr|plan(?!illa)|cr[eé]dito|add ?-?on|facturac|suscrip|precio|paquete|l[ií]mite de/i.test(
    titulo ?? ''
  )
}

/** Instructivo: qué hace y a quién aplica. Es lo que alguien lee para poder explicarlo. */
export function requisitoInstructivo(f: DeliveryInput): Requisito {
  if (!esDeCaraAlCliente(f.type, f.producto)) return { estado: 'no-aplica', faltan: [] }
  const faltan: string[] = []
  if (!lleno(f.descripcionCliente)) faltan.push('descripción')
  if (!lleno(f.aQuienAplica)) faltan.push('a quién aplica')
  return {
    estado: faltan.length ? 'pendiente' : 'cumplido',
    faltan,
    desde: faltan.length ? null : fechaISO(f.instructivoAt),
  }
}

/**
 * Material: el mensaje que Ventas copia, y algo para mostrar.
 *
 * OJO con `onePagerUrl` y `videoUrl`: el parser del comentario del issue los extrae
 * (ver `lib/sync/parsers/comment.ts`), pero `NewFeatureData` no los incluye, así que
 * `createFeature` nunca los guarda y en producción esas columnas están siempre en
 * null. Por eso el requisito se cumple con `screenshotsUrl`, que sí se guarda y sí es
 * editable en el sitio: pedir un one-pager que el pipeline descarta dejaría esta
 * columna en rojo para siempre por un motivo que no tiene nada que ver con el trabajo
 * del equipo. Si algún día se conecta el pipeline, los dos campos ya cuentan acá.
 */
export function requisitoMaterial(f: DeliveryInput): Requisito {
  if (!esDeCaraAlCliente(f.type, f.producto)) return { estado: 'no-aplica', faltan: [] }
  const faltan: string[] = []
  if (!lleno(f.mensajeSugerido)) faltan.push('mensaje sugerido')
  if (!lleno(f.screenshotsUrl) && !lleno(f.onePagerUrl) && !lleno(f.videoUrl)) {
    faltan.push('captura, one-pager o video')
  }
  return {
    estado: faltan.length ? 'pendiente' : 'cumplido',
    faltan,
    desde: faltan.length ? null : fechaISO(f.materialAt),
  }
}

/**
 * Chargebee: HOY NO SE PUEDE VERIFICAR, y el motivo importa.
 *
 * La API de Chargebee se lee sin problema (280 ítems en cliengo.chargebee.com), pero
 * para preguntar "¿este feature está configurado?" hace falta saber QUÉ ÍTEM de
 * Chargebee le corresponde, y ese vínculo no existe en ningún campo. Es exactamente
 * la convención de SKU pendiente con Finanzas: el ID de Chargebee tiene que ser el
 * código interno del producto en Odoo.
 *
 * Se devuelve `sin-verificar` a propósito, en vez de inventar un ✓ o un ✗. Un ✗ falso
 * en 40 filas hace que se ignore la columna entera.
 */
export function requisitoChargebee(f: DeliveryInput): Requisito {
  if (!tocaFacturacion(f.type, f.producto, f.tituloAmigable)) {
    return { estado: 'no-aplica', faltan: [] }
  }
  return { estado: 'sin-verificar', faltan: ['falta la convención de SKU para poder cruzarlo'] }
}

export interface DeliveryFila {
  instructivo: Requisito
  material: Requisito
  chargebee: Requisito
  /** Cuántos requisitos que corresponden están sin cumplir. */
  pendientes: number
}

export function evaluar(f: DeliveryInput): DeliveryFila {
  const instructivo = requisitoInstructivo(f)
  const material = requisitoMaterial(f)
  const chargebee = requisitoChargebee(f)
  const pendientes = [instructivo, material, chargebee].filter(r => r.estado === 'pendiente').length
  return { instructivo, material, chargebee, pendientes }
}

function fechaISO(v: string | Date | null | undefined): string | null {
  if (!v) return null
  return v instanceof Date ? v.toISOString() : v
}

/**
 * Estampa la fecha en que un requisito pasa a cumplido, comparando contra el estado
 * anterior. NO estampa la primera vez que ve un requisito ya cumplido: no sabemos
 * desde cuándo lo está, y poner la fecha de hoy en todos diría que todos se
 * cumplieron hoy. Es la misma disciplina que `Alcance At` en el board y el mismo
 * motivo por el que las fechas del 21-22/08/2026 en `Rolled Out At` son una marca de
 * migración y no fechas reales.
 */
export function fechasACalzar(
  antes: DeliveryInput | null,
  ahora: DeliveryInput
): { instructivoAt?: Date; materialAt?: Date } {
  const out: { instructivoAt?: Date; materialAt?: Date } = {}
  const hoy = new Date()

  const cumplioInstructivo = requisitoInstructivo(ahora).estado === 'cumplido'
  const cumplioMaterial = requisitoMaterial(ahora).estado === 'cumplido'

  if (!antes) {
    // Feature nueva: si nace con el requisito cumplido, ese ES el momento.
    if (cumplioInstructivo) out.instructivoAt = hoy
    if (cumplioMaterial) out.materialAt = hoy
    return out
  }

  if (cumplioInstructivo && requisitoInstructivo(antes).estado !== 'cumplido') {
    out.instructivoAt = hoy
  }
  if (cumplioMaterial && requisitoMaterial(antes).estado !== 'cumplido') {
    out.materialAt = hoy
  }
  return out
}
