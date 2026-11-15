import { NextRequest, NextResponse } from 'next/server'
import { getLatest, safeDevice } from '@/lib/influx'
import { cached } from '@/lib/cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const device = safeDevice(req.nextUrl.searchParams.get('device'))
  try {
    const latest = await cached(`latest:${device}`, 4000, () => getLatest(device))
    const ageSeconds = latest.timestamp
      ? Math.max(0, (Date.now() - new Date(latest.timestamp).getTime()) / 1000)
      : null
    return NextResponse.json(
      {
        device_id: device,
        timestamp: latest.timestamp,
        age_seconds: ageSeconds === null ? null : Math.round(ageSeconds),
        values: latest.values,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal membaca data terbaru'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
