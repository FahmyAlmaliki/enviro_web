import { NextRequest, NextResponse } from 'next/server'
import { getHistory, getReadings, safeDevice } from '@/lib/influx'
import { SENSOR_MAP, type SensorKey } from '@/lib/sensors'
import { cached } from '@/lib/cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED = new Set(['1h', '6h', '24h', '7d', '30d'])

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const device = safeDevice(params.get('device'))
  const rawRange = params.get('range') ?? '24h'
  const range = ALLOWED.has(rawRange) ? rawRange : '24h'
  const sensor = params.get('sensor') ?? 'co'

  try {
    if (sensor === 'all') {
      const limit = Number(params.get('limit') ?? 100)
      const safeLimit = Number.isFinite(limit) ? limit : 100
      const rows = await cached(`readings:${device}:${range}:${safeLimit}`, 20000, () =>
        getReadings(device, range, safeLimit),
      )
      return NextResponse.json(
        { sensor: 'all', range, rows },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }

    if (!(sensor in SENSOR_MAP)) {
      return NextResponse.json({ error: 'Sensor tidak dikenal' }, { status: 400 })
    }

    const def = SENSOR_MAP[sensor as SensorKey]
    const points = await cached(`history:${device}:${sensor}:${range}`, 30000, () =>
      getHistory(device, range, sensor),
    )
    return NextResponse.json(
      { sensor, label: def.label, unit: def.unit, range, points },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal membaca riwayat'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
