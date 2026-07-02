import { NextResponse } from 'next/server'
import { updateFeatureContent, getFeatureById } from '@/lib/db/repository'
import { ESTADOS, type EstadoDisponibilidad } from '@/lib/types'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PUT(request: Request, { params }: RouteContext) {
  // Auth simple: contraseña compartida. Ver el sitio es libre; solo editar la pide.
  const password = request.headers.get('x-edit-password')
  if (!process.env.EDIT_PASSWORD) {
    return NextResponse.json(
      { error: 'EDIT_PASSWORD no está configurada en el servidor (Vercel)' },
      { status: 503 }
    )
  }
  if (password !== process.env.EDIT_PASSWORD) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })
  }

  const { id } = await params
  const existing = await getFeatureById(id)
  if (!existing) {
    return NextResponse.json({ error: 'Feature no encontrada' }, { status: 404 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const titulo = typeof body.tituloAmigable === 'string' ? body.tituloAmigable.trim() : ''
  if (!titulo) {
    return NextResponse.json({ error: 'El título es obligatorio' }, { status: 400 })
  }

  const estado = String(body.estadoDisponibilidad ?? '')
  if (!ESTADOS.includes(estado as EstadoDisponibilidad)) {
    return NextResponse.json({ error: `Estado inválido: ${estado}` }, { status: 400 })
  }

  const clean = (v: unknown): string | null => {
    if (typeof v !== 'string') return null
    const t = v.trim()
    return t === '' ? null : t
  }

  try {
    await updateFeatureContent(id, {
      tituloAmigable: titulo,
      descripcionCliente: clean(body.descripcionCliente),
      aQuienAplica: clean(body.aQuienAplica),
      mensajeSugerido: clean(body.mensajeSugerido),
      featureFlag: clean(body.featureFlag),
      screenshotsUrl: clean(body.screenshotsUrl),
      estadoDisponibilidad: estado as EstadoDisponibilidad,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al guardar' },
      { status: 500 }
    )
  }
}
