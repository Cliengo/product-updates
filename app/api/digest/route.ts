import { NextResponse } from 'next/server'
import { runWeeklyDigest } from '@/lib/sync'

/**
 * Resumen semanal al canal de Chat: UN mensaje con lo que pasó a estar
 * disponible para todos. Lo dispara el workflow `digest.yml` (lunes).
 * `?days=N` cambia la ventana, `?dry=1` solo devuelve la lista sin postear.
 */
export async function POST(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')

  if (!process.env.SYNC_SECRET_TOKEN || token !== process.env.SYNC_SECRET_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params = new URL(request.url).searchParams
  const daysParam = Number(params.get('days'))
  const days = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : 7
  const dry = params.get('dry') === '1'

  try {
    const result = await runWeeklyDigest({ days, dry })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Digest failed' },
      { status: 500 }
    )
  }
}
