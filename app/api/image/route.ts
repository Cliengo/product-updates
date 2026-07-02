import { NextResponse } from 'next/server'

/**
 * Proxy de imágenes de adjuntos de GitHub (repo privado). Las trae autenticadas
 * con GITHUB_TOKEN y las sirve, para poder previsualizarlas en el sitio.
 * Solo permite hosts de adjuntos de GitHub (evita open proxy / SSRF).
 */
export async function GET(request: Request) {
  const u = new URL(request.url).searchParams.get('u')
  if (!u) return new NextResponse('Falta parámetro u', { status: 400 })

  let target: URL
  try {
    target = new URL(u)
  } catch {
    return new NextResponse('URL inválida', { status: 400 })
  }

  const allowed =
    target.protocol === 'https:' &&
    (target.hostname === 'github.com' || target.hostname.endsWith('.githubusercontent.com')) &&
    (target.pathname.startsWith('/user-attachments/') || target.hostname.endsWith('.githubusercontent.com'))

  if (!allowed) {
    return new NextResponse('Host no permitido', { status: 400 })
  }

  const token = process.env.GITHUB_TOKEN
  const res = await fetch(u, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (!res.ok) {
    return new NextResponse('No se pudo obtener la imagen', { status: 404 })
  }

  const contentType = res.headers.get('content-type') || 'image/png'
  if (!contentType.startsWith('image/')) {
    return new NextResponse('El recurso no es una imagen', { status: 415 })
  }

  const buf = await res.arrayBuffer()
  return new NextResponse(buf, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  })
}
