import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { SENSOR_KEYS, type SensorKey } from '@/lib/sensors'
import { safeDevice, writeReadings, type NormalizedReading } from '@/lib/influx'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const numeric = z.number().finite().min(0).max(1_000_000)

const readingSchema = z
  .object({
    device_id: z
      .string()
      .regex(/^[a-zA-Z0-9._-]{1,64}$/, 'device_id hanya boleh huruf, angka, titik, garis bawah, strip')
      .optional(),
    timestamp: z.string().optional(),
    gases: z.record(z.string(), numeric).optional(),
    sps30: z.record(z.string(), numeric).optional(),
    values: z.record(z.string(), numeric).optional(),
  })
  .passthrough()

const listSchema = z.array(readingSchema).min(1).max(5000)

type ReadingInput = z.infer<typeof readingSchema>

function normalize(input: ReadingInput): NormalizedReading {
  const fields: Partial<Record<SensorKey, number>> = {}
  const put = (key: string, value: number) => {
    const normalizedKey = key.toLowerCase() as SensorKey
    if (SENSOR_KEYS.includes(normalizedKey) && Number.isFinite(value)) {
      fields[normalizedKey] = value
    }
  }

  for (const [key, value] of Object.entries(input.gases ?? {})) put(key, value)
  for (const [key, value] of Object.entries(input.sps30 ?? {})) put(key, value)
  for (const [key, value] of Object.entries(input.values ?? {})) put(key, value)
  // field top-level seperti so2_voltage, temp_sht, pressure
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'number') put(key, value)
  }

  let timestamp = new Date()
  if (input.timestamp) {
    const parsed = new Date(input.timestamp)
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`timestamp tidak valid: ${input.timestamp}`)
    }
    timestamp = parsed
  }

  return {
    device_id: safeDevice(input.device_id),
    timestamp,
    fields,
  }
}

export async function POST(req: NextRequest) {
  const expectedKey = process.env.INGEST_API_KEY
  const providedKey = req.headers.get('x-api-key')
  if (!expectedKey || providedKey !== expectedKey) {
    return NextResponse.json({ error: 'API key tidak valid' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body bukan JSON yang valid' }, { status: 400 })
  }

  let candidate: unknown
  if (Array.isArray(body)) {
    candidate = body
  } else if (
    body &&
    typeof body === 'object' &&
    Array.isArray((body as { readings?: unknown }).readings)
  ) {
    candidate = (body as { readings: unknown }).readings
  } else {
    candidate = [body]
  }

  const parsed = listSchema.safeParse(candidate)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Payload tidak valid', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const list: ReadingInput[] = parsed.data

  try {
    const normalized = list.map(normalize).filter((r) => Object.keys(r.fields).length > 0)
    if (normalized.length === 0) {
      return NextResponse.json({ error: 'Tidak ada field sensor yang dikenali' }, { status: 400 })
    }
    await writeReadings(normalized)
    return NextResponse.json({
      ok: true,
      written: normalized.length,
      timestamp: normalized[normalized.length - 1].timestamp.toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal menulis ke InfluxDB'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
