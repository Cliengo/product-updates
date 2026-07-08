import { NextResponse } from 'next/server'
import { runSync, notifyIssue } from '@/lib/sync'

// El sync genera muchos items con IA (con pausas por rate limit) → necesita margen.
export const maxDuration = 300

export async function POST(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')

  if (!process.env.SYNC_SECRET_TOKEN || token !== process.env.SYNC_SECRET_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params = new URL(request.url).searchParams
  // ?reset=1 borra toda la data antes de sincronizar (limpieza puntual).
  const reset = params.get('reset') === '1'
  // ?silent=1 sincroniza sin postear novedades al canal de Chat (backfill).
  const silent = params.get('silent') === '1'
  // ?notify=<nº issue> postea al Chat la card de UNA feature ya existente.
  const notify = params.get('notify')

  try {
    if (notify) {
      const result = await notifyIssue(Number(notify))
      return NextResponse.json(result)
    }
    const result = await runSync({ reset, silent })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
