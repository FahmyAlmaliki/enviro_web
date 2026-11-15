import { NextRequest, NextResponse } from 'next/server'
import { getStats, safeDevice } from '@/lib/influx'
import { cached } from '@/lib/cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED = new Set(['1h', '6h', '24h', '7d', '30d'])

export async function GET(req: NextRequest) {
  const device = safeDevice(req.nextUrl.searchParams.get('device'))
  const rawRange = req.nextUrl.searchParams.get('range') ?? '24h'
  const range = ALLOWED.has(rawRange) ? rawRange : '24h'

  try {
    const result = await cached(`stats:${device}:${range}`, 30000, () => getStats(device, range))
    return NextResponse.json(
      {
        device_id: device,
        range,
        from: result.from,
        to: result.to,
        stats: result.stats,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal menghitung statistik'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
