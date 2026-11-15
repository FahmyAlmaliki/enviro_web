import { NextResponse } from 'next/server'
import { getLatest, pingInflux, safeDevice } from '@/lib/influx'
import { cached } from '@/lib/cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const result = await cached('health', 10000, async () => {
    const [influxOk, latest] = await Promise.all([
      pingInflux(),
      getLatest(safeDevice(null)).catch(() => ({ timestamp: null, values: {} })),
    ])
    const ageSeconds = latest.timestamp
      ? Math.max(0, (Date.now() - new Date(latest.timestamp).getTime()) / 1000)
      : null
    return {
      ok: influxOk,
      influx: influxOk,
      last_reading: latest.timestamp,
      age_seconds: ageSeconds === null ? null : Math.round(ageSeconds),
      version: '1.0.0',
    }
  })

  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
