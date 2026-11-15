import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { SENSOR_KEYS, type SensorKey, type ThresholdMap } from '@/lib/sensors'
import { readThresholds, writeThresholds } from '@/lib/threshold-store'
import { DEFAULT_THRESHOLDS } from '@/lib/thresholds'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const entrySchema = z.object({
  warn: z.number().finite().min(0),
  danger: z.number().finite().min(0),
})

const bodySchema = z.record(z.string(), entrySchema)

export async function GET() {
  const thresholds = await readThresholds()
  return NextResponse.json(
    { thresholds, defaults: DEFAULT_THRESHOLDS },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function PUT(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body bukan JSON yang valid' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Format ambang batas tidak valid', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const next: ThresholdMap = { ...DEFAULT_THRESHOLDS }
  for (const key of SENSOR_KEYS) {
    const entry = parsed.data[key as SensorKey]
    if (!entry) continue
    if (entry.danger < entry.warn) {
      return NextResponse.json(
        { error: `Batas bahaya ${key} tidak boleh lebih kecil dari batas waspada` },
        { status: 400 },
      )
    }
    next[key] = entry
  }

  await writeThresholds(next)
  return NextResponse.json({ ok: true, thresholds: next })
}
