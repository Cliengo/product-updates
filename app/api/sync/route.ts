import { NextResponse } from 'next/server'
import { runSync } from '@/lib/sync'

export async function POST(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')

  if (!process.env.SYNC_SECRET_TOKEN || token !== process.env.SYNC_SECRET_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ?reset=1 borra toda la data antes de sincronizar (limpieza puntual).
  const reset = new URL(request.url).searchParams.get('reset') === '1'

  try {
    const result = await runSync({ reset })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
