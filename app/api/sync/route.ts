import { NextResponse } from 'next/server'
import { runSync } from '@/lib/sync'

export async function POST(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')

  if (!process.env.SYNC_SECRET_TOKEN || token !== process.env.SYNC_SECRET_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runSync()
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
