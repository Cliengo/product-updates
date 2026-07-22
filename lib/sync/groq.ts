const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
// Groq apagó meta-llama/llama-4-scout-17b-16e-instruct el 17/07/2026; este es el
// reemplazo que recomienda su doc de deprecaciones. Si se cambia, verificar que el
// modelo soporte response_format json_object.
const DEFAULT_MODEL = 'openai/gpt-oss-120b'
const MAX_RETRIES = 4

export interface GeneratedUpdate {
  titulo: string
  descripcion: string
  aQuienAplica: string
  mensajeSugerido: string
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * POST a Groq con reintentos ante 429 (rate limit por tokens/minuto) y 5xx,
 * respetando el header Retry-After. Clave cuando el sync genera muchos items
 * seguidos y se pasa del TPM del plan.
 */
async function groqFetch(apiKey: string, body: string): Promise<Response | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body,
    })
    if (res.status !== 429 && res.status < 500) return res
    if (attempt === MAX_RETRIES) return res

    const retryAfter = Number(res.headers.get('retry-after'))
    const waitMs = Math.min(
      retryAfter > 0 ? retryAfter * 1000 : 2000 * (attempt + 1),
      15000
    )
    console.warn(`[groq] ${res.status}, reintento ${attempt + 1}/${MAX_RETRIES} en ${waitMs}ms`)
    await sleep(waitMs)
  }
  return null
}

/**
 * Genera el contenido de un product update a partir de un issue técnico, con
 * Groq (API compatible con OpenAI): título amigable, descripción para cliente,
 * a quién aplica y un mensaje sugerido para CS/Ventas.
 *
 * Devuelve null si no hay API key o si la llamada falla — el caller debe usar
 * el título del issue como fallback.
 */
export async function generateProductUpdate(
  issueTitle: string,
  issueBody: string,
  tipo?: string | null
): Promise<GeneratedUpdate | null> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    console.warn('[groq] GROQ_API_KEY no configurada, se omite generación IA')
    return null
  }

  // Para fixes (bugs) la descripción es más clara contando el antes y el después;
  // para features nuevas no hay un "antes", así que se describe qué aporta.
  const esFix = tipo === 'Bug Cliente' || tipo === 'Bug Producto'
  const descripcionRegla = esFix
    ? '2. "descripcion": 2 oraciones cortas contando el antes y el después, con este formato exacto: "Antes, <qué pasaba / el problema>. Ahora, <qué sucede tras el arreglo>." Sin tecnicismos.'
    : '2. "descripcion": 1 a 2 oraciones. Qué hace la funcionalidad y qué valor le da al cliente.'

  const model = process.env.GROQ_MODELO || DEFAULT_MODEL
  const prompt = [
    'Sos un asistente de Producto. Dado el siguiente issue técnico, generá en español, sin tecnicismos:',
    '1. "titulo": título amigable para equipos internos (Marketing, CS, Ventas). Máx 8 palabras.',
    descripcionRegla,
    '3. "aQuienAplica": a qué usuarios/planes aplica, inferido del contexto. Si no se puede inferir, poné "".',
    '4. "mensajeSugerido": mensaje corto y listo para que CS/Ventas le comunique al cliente.',
    '',
    `Título técnico: ${issueTitle}`,
    '',
    `Descripción técnica:\n${(issueBody || '').slice(0, 700)}`,
    '',
    'Respondé ÚNICAMENTE con un JSON válido, sin markdown ni explicaciones:',
    '{"titulo":"...","descripcion":"...","aQuienAplica":"...","mensajeSugerido":"..."}',
  ].join('\n')

  try {
    const res = await groqFetch(
      apiKey,
      JSON.stringify({
        model,
        max_tokens: 1024,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      })
    )

    if (!res || !res.ok) {
      const errText = res ? await res.text() : 'sin respuesta'
      console.warn(`[groq] error ${res?.status ?? '-'}: ${errText}`)
      return null
    }

    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content?.trim()
    if (!text) return null

    const parsed = JSON.parse(text)
    if (!parsed.titulo) return null

    return {
      titulo: String(parsed.titulo).trim(),
      descripcion: String(parsed.descripcion ?? '').trim(),
      aQuienAplica: String(parsed.aQuienAplica ?? '').trim(),
      mensajeSugerido: String(parsed.mensajeSugerido ?? '').trim(),
    }
  } catch (err) {
    console.warn(
      `[groq] falló la generación, se usará fallback: ${err instanceof Error ? err.message : String(err)}`
    )
    return null
  }
}
