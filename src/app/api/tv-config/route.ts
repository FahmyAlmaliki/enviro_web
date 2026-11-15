import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { TV_GAS_KEYS, type SensorKey } from '@/lib/sensors'
import {
  DEFAULT_TV_CONFIG,
  readTvConfig,
  writeTvConfig,
} from '@/lib/tv-config-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  gases: z.array(z.string()).max(TV_GAS_KEYS.length),
})

export async function GET() {
  const config = await readTvConfig()
  return NextResponse.json(
    {
      config,
      available: TV_GAS_KEYS,
      defaults: DEFAULT_TV_CONFIG,
    },
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
      { error: 'Format pilihan TV tidak valid', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const gases = Array.from(new Set(parsed.data.gases)).filter((key): key is SensorKey =>
    TV_GAS_KEYS.includes(key as SensorKey),
  )

  await writeTvConfig({ gases })
  return NextResponse.json({ ok: true, config: { gases } })
}
