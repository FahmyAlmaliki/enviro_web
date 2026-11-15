'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { HistoryPayload, ThresholdMap } from '@/lib/sensors'
import {
  ENV_SENSORS,
  GAS_SENSORS,
  PM_SENSORS,
  SENSOR_MAP,
  SO2_VOLTAGE,
  type SensorKey,
} from '@/lib/sensors'
import { fmtNumber, RANGE_OPTIONS } from '@/lib/format'
import { apiPath } from '@/lib/client-api'
import { usePoll } from '@/lib/use-poll'

interface Props {
  thresholds: ThresholdMap
  device: string
}

const CHART_SENSORS = [...GAS_SENSORS, SO2_VOLTAGE, ...PM_SENSORS, ...ENV_SENSORS]

function tickLabel(iso: string, range: string): string {
  const date = new Date(iso)
  if (range === '7d' || range === '30d') {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
    }).format(date)
  }
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function ChartCard({ thresholds, device }: Props) {
  const [sensor, setSensor] = useState<SensorKey>('co')
  const [range, setRange] = useState('24h')
  const [mounted, setMounted] = useState(false)

  const def = SENSOR_MAP[sensor]
  const url = apiPath(`/api/history?device=${device}&sensor=${sensor}&range=${range}`)
  const history = usePoll<HistoryPayload>(url, 60000)

  useEffect(() => {
    setMounted(true)
  }, [])

  const data = useMemo(
    () =>
      (history.data?.points ?? []).map((point) => ({
        label: tickLabel(point.t, range),
        value: Number(point.v.toFixed(def.decimals + 1)),
      })),
    [history.data, range, def.decimals],
  )

  const threshold = thresholds[sensor]
  const values = data.map((d) => d.value)
  const dataMax = values.length ? Math.max(...values) : 0
  const rawMax = Math.max(dataMax, threshold?.danger ?? 0)
  const yMax = rawMax > 0 ? Math.ceil(rawMax * 1.15) : 1

  return (
    <div className="rounded-card bg-surface shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-sm font-bold text-ink">Grafik Historis</h2>
          <p className="text-[11px] text-muted">
            {def.label} · {def.unit}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={sensor}
            onChange={(event) => setSensor(event.target.value as SensorKey)}
            className="rounded-[6px] border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink outline-none focus:border-primary"
          >
            {CHART_SENSORS.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            value={range}
            onChange={(event) => setRange(event.target.value)}
            className="rounded-[6px] border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink outline-none focus:border-primary"
          >
            {RANGE_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="px-3 py-4">
        {history.error ? (
          <div className="grid h-[300px] place-items-center text-xs text-danger-ink">
            Gagal memuat grafik: {history.error}
          </div>
        ) : !mounted || history.loading ? (
          <div className="grid h-[300px] place-items-center text-xs text-muted">Memuat grafik…</div>
        ) : data.length === 0 ? (
          <div className="grid h-[300px] place-items-center text-xs text-muted">
            Belum ada data pada rentang ini.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data} margin={{ top: 18, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e7ec" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#98a2b3' }}
                tickLine={false}
                axisLine={{ stroke: '#e4e7ec' }}
                minTickGap={24}
              />
              <YAxis
                domain={[0, yMax]}
                tickCount={6}
                tickFormatter={(value) => fmtNumber(Number(value), 0)}
                tick={{ fontSize: 10, fill: '#98a2b3' }}
                tickLine={false}
                axisLine={false}
                width={54}
              />
              <Tooltip
                formatter={(value) => [`${fmtNumber(Number(value), def.decimals)} ${def.unit}`, def.label]}
                labelStyle={{ color: '#1f2a37', fontSize: 11 }}
                contentStyle={{
                  borderRadius: 6,
                  border: '1px solid #e4e7ec',
                  fontSize: 11,
                  boxShadow: '0 3px 12px rgba(16,24,40,.08)',
                }}
              />
              {threshold ? (
                <ReferenceLine
                  y={threshold.warn}
                  stroke="#f79009"
                  strokeDasharray="4 4"
                  label={{ value: 'waspada', fontSize: 9, fill: '#b54708', position: 'insideTopRight' }}
                />
              ) : null}
              {threshold ? (
                <ReferenceLine
                  y={threshold.danger}
                  stroke="#f04438"
                  strokeDasharray="4 4"
                  label={{ value: 'bahaya', fontSize: 9, fill: '#b42318', position: 'insideTopRight' }}
                />
              ) : null}
              <Line
                type="monotone"
                dataKey="value"
                stroke={def.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
