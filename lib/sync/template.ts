export const PRODUCT_UPDATE_HEADER = '## 📣 Product Update'

export interface TemplateInput {
  titulo: string
  descripcion?: string
}

/**
 * Arma el cuerpo del comentario "Product Update" que se postea en el issue.
 * Mismo formato que el parser (lib/sync/parsers/comment.ts) espera leer.
 * Los campos opcionales quedan como comentarios HTML para que el PM los complete.
 */
export function buildTemplateComment({ titulo, descripcion }: TemplateInput): string {
  return [
    PRODUCT_UPDATE_HEADER,
    '',
    '### Título amigable',
    titulo,
    '',
    '### Descripción para cliente',
    descripcion || '<!-- Una o dos oraciones explicando qué hace y qué valor da al cliente -->',
    '',
    '### Estado actual',
    'rolled-out',
    '',
    '### Feature flag (LaunchDarkly)',
    '<!-- (opcional) nombre del flag -->',
    '',
    '### Plan / Hub mínimo requerido',
    '<!-- (opcional) ej: Pro, todos los planes -->',
    '',
    '### A quién aplica',
    '<!-- (opcional) ej: Todos los usuarios con inbox activo -->',
    '',
    '### Mensaje sugerido para cliente',
    '<!-- (opcional) texto para CS/Ventas -->',
    '',
    '### Assets',
    '<!-- (opcional) -->',
    '- Screenshots: [link]',
    '- Video demo: [link]',
    '- One-pager: [link]',
    '',
    '### FAQ interna',
    '<!-- (opcional, formato: - Pregunta: Respuesta) -->',
    '',
    '### Notas internas',
    '<!-- (opcional) contexto para el equipo -->',
  ].join('\n')
}
