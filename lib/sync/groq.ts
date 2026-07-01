const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

export interface GeneratedUpdate {
  titulo: string
  descripcion: string
}

/**
 * Genera un título amigable y una descripción para cliente a partir de un
 * issue técnico, usando Groq (API compatible con OpenAI).
 *
 * Devuelve null si no hay API key configurada o si la llamada falla — el
 * caller debe usar el título original del issue como fallback.
 */
export async function generateProductUpdate(
  issueTitle: string,
  issueBody: string
): Promise<GeneratedUpdate | null> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    console.warn('[groq] GROQ_API_KEY no configurada, se omite generación IA')
    return null
  }

  const model = process.env.GROQ_MODELO || DEFAULT_MODEL
  const prompt = [
    'Dado el siguiente issue técnico, generá en español:',
    '1. Un título amigable para equipos internos (Marketing, CS, Ventas). Máximo 8 palabras, sin tecnicismos.',
    '2. Una descripción para el cliente de 1 a 2 oraciones. Explicá qué hace la funcionalidad y qué valor le da al cliente. Sin tecnicismos.',
    '',
    `Título técnico: ${issueTitle}`,
    '',
    `Descripción técnica:\n${(issueBody || '').slice(0, 1000)}`,
    '',
    'Respondé ÚNICAMENTE con un JSON con este formato exacto (sin markdown, sin explicaciones):',
    '{"titulo": "...", "descripcion": "..."}',
  ].join('\n')

  try {
    const res = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 300,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.warn(`[groq] error ${res.status}: ${errText}`)
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
    }
  } catch (err) {
    console.warn(
      `[groq] falló la generación, se usará fallback: ${err instanceof Error ? err.message : String(err)}`
    )
    return null
  }
}
