import 'server-only'
import { InfluxDB } from '@influxdata/influxdb-client'
import { SENSOR_KEYS, type SensorKey } from './sensors'
import { rangeToFlux, rangeToInterval } from './format'

const url = process.env.INFLUX_URL ?? 'http://influxdb:8086'
const token = process.env.INFLUX_TOKEN ?? ''
const org = process.env.INFLUX_ORG ?? 'ub'
const bucket = process.env.INFLUX_BUCKET ?? 'air_quality'

const MEASUREMENT = 'air_quality'

let client: InfluxDB | null = null

function getClient(): InfluxDB {
  if (!client) {
    client = new InfluxDB({ url, token, timeout: 15000 })
  }
  return client
}

export function influxInfo() {
  return { url, org, bucket }
}

const DEVICE_RE = /^[a-zA-Z0-9._-]{1,64}$/

export function safeDevice(device?: string | null): string {
  if (device && DEVICE_RE.test(device)) return device
  return 'node-01'
}

export type QueryRow = Record<string, unknown>

export function queryRows(flux: string): Promise<QueryRow[]> {
  const queryApi = getClient().getQueryApi(org)
  return new Promise((resolve, reject) => {
    const rows: QueryRow[] = []
    queryApi.queryRows(flux, {
      next(row, tableMeta) {
        rows.push(tableMeta.toObject(row) as QueryRow)
      },
      error(error) {
        reject(error)
      },
      complete() {
        resolve(rows)
      },
    })
  })
}

export interface NormalizedReading {
  device_id: string
  timestamp: Date
  fields: Partial<Record<SensorKey, number>>
}

export async function writeReadings(readings: NormalizedReading[]): Promise<void> {
  if (readings.length === 0) return

  const lines: string[] = []
  for (const reading of readings) {
    const fieldSet = Object.entries(reading.fields)
      .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
      .map(([key, value]) => `${key}=${value}`)
      .join(',')
    if (!fieldSet) continue
    const timestampNs = BigInt(reading.timestamp.getTime()) * 1_000_000n
    lines.push(`${MEASUREMENT},device_id=${reading.device_id} ${fieldSet} ${timestampNs}`)
  }
  if (lines.length === 0) return

  const endpoint = `${url.replace(/\/$/, '')}/api/v2/write?org=${encodeURIComponent(
    org,
  )}&bucket=${encodeURIComponent(bucket)}&precision=ns`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Token ${token}`,
      'Content-Type': 'text/plain; charset=utf-8',
    },
    body: lines.join('\n'),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`InfluxDB menolak penulisan (${res.status}): ${detail.slice(0, 300)}`)
  }
}

function filterClause(device: string): string {
  return `r._measurement == ${JSON.stringify(MEASUREMENT)} and r.device_id == ${JSON.stringify(device)}`
}

export interface LatestResult {
  timestamp: string | null
  values: Partial<Record<SensorKey, number>>
}

export async function getLatest(device: string): Promise<LatestResult> {
  const flux = `from(bucket: ${JSON.stringify(bucket)})
  |> range(start: -7d)
  |> filter(fn: (r) => ${filterClause(device)})
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: 1)`

  const rows = await queryRows(flux)
  if (rows.length === 0) return { timestamp: null, values: {} }

  const row = rows[0]
  const values: Partial<Record<SensorKey, number>> = {}
  for (const key of SENSOR_KEYS) {
    const value = row[key]
    if (typeof value === 'number' && Number.isFinite(value)) values[key] = value
  }
  const time = row._time
  return { timestamp: typeof time === 'string' ? time : null, values }
}

export interface StatsResult {
  stats: Record<string, { avg: number | null; min: number | null; max: number | null }>
  from: string
  to: string
}

export async function getStats(device: string, range: string): Promise<StatsResult> {
  const start = rangeToFlux(range)
  const base = `from(bucket: ${JSON.stringify(bucket)})
  |> range(start: ${start})
  |> filter(fn: (r) => ${filterClause(device)})`

  const toDate = new Date()
  const fromDate = new Date(toDate.getTime() - rangeToMs(range))

  const [avgRows, minRows, maxRows] = await Promise.all([
    queryRows(`${base}\n  |> mean()`),
    queryRows(`${base}\n  |> min()`),
    queryRows(`${base}\n  |> max()`),
  ])

  const stats: StatsResult['stats'] = {}
  for (const key of SENSOR_KEYS) {
    stats[key] = { avg: null, min: null, max: null }
  }

  const assign = (rows: QueryRow[], slot: 'avg' | 'min' | 'max') => {
    for (const row of rows) {
      const field = row._field
      const value = row._value
      if (typeof field === 'string' && typeof value === 'number' && stats[field]) {
        stats[field][slot] = value
      }
    }
  }
  assign(avgRows, 'avg')
  assign(minRows, 'min')
  assign(maxRows, 'max')

  return { stats, from: fromDate.toISOString(), to: toDate.toISOString() }
}

function rangeToMs(range: string): number {
  switch (range) {
    case '1h':
      return 3600_000
    case '6h':
      return 6 * 3600_000
    case '7d':
      return 7 * 86400_000
    case '30d':
      return 30 * 86400_000
    case '24h':
    default:
      return 24 * 3600_000
  }
}

export interface HistoryPoint {
  t: string
  v: number
}

export async function getHistory(
  device: string,
  range: string,
  sensor: string,
): Promise<HistoryPoint[]> {
  const start = rangeToFlux(range)
  const every = rangeToInterval(range)
  const flux = `from(bucket: ${JSON.stringify(bucket)})
  |> range(start: ${start})
  |> filter(fn: (r) => ${filterClause(device)} and r._field == ${JSON.stringify(sensor)})
  |> aggregateWindow(every: ${every}, fn: mean, createEmpty: false)
  |> keep(columns: ["_time", "_value"])
  |> sort(columns: ["_time"], desc: false)`

  const rows = await queryRows(flux)
  return rows
    .map((row) => ({
      t: typeof row._time === 'string' ? row._time : new Date(String(row._time)).toISOString(),
      v: typeof row._value === 'number' ? row._value : Number(row._value),
    }))
    .filter((p) => Number.isFinite(p.v))
}

export type ReadingRow = Record<string, string | number | null>

export async function getReadings(
  device: string,
  range: string,
  limit: number,
): Promise<ReadingRow[]> {
  const start = rangeToFlux(range)
  const flux = `from(bucket: ${JSON.stringify(bucket)})
  |> range(start: ${start})
  |> filter(fn: (r) => ${filterClause(device)})
  |> tail(n: ${Math.max(1, Math.min(limit, 5000))})
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: ${Math.max(1, Math.min(limit, 5000))})`

  const rows = await queryRows(flux)
  return rows.map((row) => {
    const out: ReadingRow = { time: String(row._time ?? '') }
    for (const key of SENSOR_KEYS) {
      const value = row[key]
      out[key] = typeof value === 'number' ? value : null
    }
    return out
  })
}

export async function pingInflux(): Promise<boolean> {
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/health`, {
      headers: { Authorization: `Token ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return false
    const body = (await res.json()) as { status?: string }
    return body.status === 'pass'
  } catch {
    return false
  }
}
