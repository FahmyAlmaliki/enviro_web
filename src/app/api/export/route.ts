import { NextRequest } from 'next/server'
import { getReadings, safeDevice } from '@/lib/influx'
import { SENSORS } from '@/lib/sensors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED = new Set(['1h', '6h', '24h', '7d', '30d'])

function escapeCell(value: string, delimiter: string): string {
  if (value.includes(delimiter) || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replaceAll('"', '""')}"`
  }
  return value
}

function formatNumber(value: number | string | null, decimals: number, decimalComma: boolean): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ''
  const text = value.toFixed(decimals)
  return decimalComma ? text.replace('.', ',') : text
}

const wibFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

function formatWib(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = wibFormatter.formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const device = safeDevice(params.get('device'))
  const rawRange = params.get('range') ?? '24h'
  const range = ALLOWED.has(rawRange) ? rawRange : '24h'

  // Default: titik koma + desimal koma agar langsung rapi di Excel (locale Indonesia).
  // Gunakan ?delimiter=, untuk CSV standar dengan desimal titik.
  const delimiter = params.get('delimiter') === ',' ? ',' : ';'
  const decimalComma = delimiter === ';'

  try {
    const rows = await getReadings(device, range, 5000)

    const header = [
      'Waktu (WIB)',
      'Device',
      ...SENSORS.map((sensor) => `${sensor.label} (${sensor.unit})`),
    ]

    const lines = [header.map((cell) => escapeCell(cell, delimiter)).join(delimiter)]

    for (const row of rows) {
      const cells = [
        formatWib(row.time ? String(row.time) : null),
        device,
        ...SENSORS.map((sensor) => formatNumber(row[sensor.key], sensor.decimals, decimalComma)),
      ]
      lines.push(cells.map((cell) => escapeCell(cell, delimiter)).join(delimiter))
    }

    const csv = '\uFEFF' + lines.join('\r\n')
    const stamp = new Date().toISOString().slice(0, 10)
    return new Response(csv, {
      headers: {
        'Content-Type': `text/csv; charset=utf-8`,
        'Content-Disposition': `attachment; filename="enviro-${device}-${range}-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal membuat CSV'
    return Response.json({ error: message }, { status: 500 })
  }
}
