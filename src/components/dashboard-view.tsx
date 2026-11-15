'use client'

import { useState } from 'react'
import type {
  LatestPayload,
  SensorKey,
  StatsPayload,
  ThresholdMap,
} from '@/lib/sensors'
import {
  ENV_SENSORS,
  GAS_SENSORS,
  PM_SENSORS,
  SO2_RAW,
  SO2_VOLTAGE,
} from '@/lib/sensors'
import { DEFAULT_THRESHOLDS } from '@/lib/thresholds'
import { RANGE_OPTIONS, fmtAge, fmtNumber, rangeLabel } from '@/lib/format'
import { apiPath } from '@/lib/client-api'
import { usePoll } from '@/lib/use-poll'
import { AlarmBanner } from './alarm-banner'
import { ChartCard } from './chart-card'
import { SensorCard } from './sensor-card'
import { StatsTable } from './stats-table'

const DEVICE = 'node-01'

export function DashboardView() {
  const [range, setRange] = useState('24h')

  const latest = usePoll<LatestPayload>(apiPath(`/api/latest?device=${DEVICE}`), 10000)
  const stats = usePoll<StatsPayload>(apiPath(`/api/stats?device=${DEVICE}&range=${range}`), 60000)
  const thresholdPoll = usePoll<{ thresholds: ThresholdMap }>(apiPath('/api/thresholds'), 120000)

  const values: Partial<Record<SensorKey, number>> = latest.data?.values ?? {}
  const thresholds = thresholdPoll.data?.thresholds ?? DEFAULT_THRESHOLDS
  const statsMap = stats.data?.stats ?? {}

  const gasCards = [...GAS_SENSORS, SO2_VOLTAGE, SO2_RAW]
  const pmCards = PM_SENSORS

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
            Pemantauan Kualitas Udara
          </p>
          <h2 className="text-xl font-bold text-ink">Ringkasan Real-time</h2>
          <p className="text-xs text-muted">
            Perangkat {DEVICE} · update {fmtAge(latest.data?.age_seconds)} · statistik{' '}
            {rangeLabel(range)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={range}
            onChange={(event) => setRange(event.target.value)}
            className="rounded-[6px] border border-line bg-surface px-3 py-2 text-xs font-medium text-ink outline-none focus:border-primary"
          >
            {RANGE_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <a
            href={apiPath(`/api/export?device=${DEVICE}&range=${range}`)}
            className="rounded-[6px] bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary-600"
          >
            Unduh CSV
          </a>
        </div>
      </div>

      {latest.error ? (
        <div className="rounded-card bg-danger-soft px-4 py-2.5 text-xs font-semibold text-danger-ink">
          Gagal memuat data sensor: {latest.error}
        </div>
      ) : null}

      <AlarmBanner values={values} thresholds={thresholds} />

      <section>
        <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wide text-muted">
          Gas &amp; SO2
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {gasCards.map((sensor) => (
            <SensorCard
              key={sensor.key}
              sensor={sensor}
              value={values[sensor.key]}
              threshold={thresholds[sensor.key]}
              stat={statsMap[sensor.key]}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wide text-muted">
          Partikulat SPS30
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {pmCards.map((sensor) => (
            <SensorCard
              key={sensor.key}
              sensor={sensor}
              value={values[sensor.key]}
              threshold={thresholds[sensor.key]}
              stat={statsMap[sensor.key]}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wide text-muted">
          Lingkungan · SHT41 &amp; BMP280
        </h3>
        <div className="rounded-card bg-surface p-5 shadow-card">
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
            {ENV_SENSORS.map((sensor) => (
              <div key={sensor.key} className="flex items-start gap-3">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px] text-[11px] font-extrabold"
                  style={{ backgroundColor: `${sensor.color}1a`, color: sensor.color }}
                >
                  {sensor.label.slice(0, 2)}
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted">{sensor.label}</p>
                  <p className="tnum text-xl font-bold leading-tight text-ink">
                    {fmtNumber(values[sensor.key], sensor.decimals)}{' '}
                    <span className="text-[11px] font-medium text-muted">{sensor.unit}</span>
                  </p>
                  <p className="text-[10px] text-muted">{sensor.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <ChartCard thresholds={thresholds} device={DEVICE} />
        <StatsTable stats={statsMap} thresholds={thresholds} rangeLabel={rangeLabel(range)} />
      </div>
    </div>
  )
}
