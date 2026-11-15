'use client'

import { Fragment, useEffect, useState } from 'react'
import type {
  HealthPayload,
  LatestPayload,
  Level,
  SensorDef,
  SensorKey,
  StatEntry,
  StatsPayload,
  Threshold,
  ThresholdMap,
} from '@/lib/sensors'
import { DEFAULT_TV_GASES, SENSOR_MAP } from '@/lib/sensors'
import { DEFAULT_THRESHOLDS, levelOf } from '@/lib/thresholds'
import { fmtAge, fmtClock, fmtDate, fmtNumber } from '@/lib/format'
import { apiPath } from '@/lib/client-api'
import { usePoll } from '@/lib/use-poll'
import { AlarmBanner } from '@/components/alarm-banner'
import { LogoSlot } from '@/components/logo-slot'
import { StatusBadge } from '@/components/status-badge'

const DEVICE = 'node-01'

const TV_LOGOS = [
  { file: 'ub', name: 'Universitas Brawijaya', caption: 'UB', width: '7.2vw' },
  { file: 'elektro', name: 'Teknik Elektro', caption: 'Elektro', width: '6.8vw' },
  { file: 'teknik-lingkungan', name: 'Teknik Lingkungan UB', caption: 'TL', width: '7.4vw' },
  { file: 'ub-green-campus', name: 'UB Green Campus', caption: 'Green Campus', width: '7.4vw' },
]

const VALUE_COLOR: Record<Level, string> = {
  normal: '#1f2a37',
  warn: '#b54708',
  danger: '#b42318',
  unknown: '#98a2b3',
}

function accent(level: Level, fallback: string): string {
  if (level === 'danger') return '#f04438'
  if (level === 'warn') return '#f79009'
  if (level === 'unknown') return '#d0d5dd'
  return fallback
}

interface TvCardProps {
  sensor: SensorDef
  value: number | undefined
  threshold: Threshold | undefined
  stat?: StatEntry
  large?: boolean
}

function TvCard({ sensor, value, threshold, stat, large = false }: TvCardProps) {
  const level = levelOf(value, threshold)

  return (
    <div
      className="flex h-full min-h-0 flex-col justify-between overflow-hidden rounded-[10px] bg-surface py-[1.1vh] pl-[1.3vw] pr-[1vw] shadow-card"
      style={{ borderLeft: `0.45vw solid ${accent(level, sensor.color)}` }}
    >
      <div className="flex items-baseline justify-between gap-[0.5vw]">
        <span className="text-[1.5vw] font-extrabold leading-none text-ink">{sensor.label}</span>
        <span className="text-[0.95vw] font-semibold text-muted">{sensor.unit}</span>
      </div>

      <div className="flex min-h-0 flex-1 items-center">
        <span
          className={`tnum font-extrabold leading-none tracking-tight ${
            large ? 'text-[5.6vw]' : 'text-[4.2vw]'
          }`}
          style={{ color: VALUE_COLOR[level] }}
        >
          {fmtNumber(value, sensor.decimals)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-[0.5vw]">
        <StatusBadge level={level} size="tv" />
        <span className="tnum text-[0.95vw] font-medium text-muted">
          min {fmtNumber(stat?.min, sensor.decimals)} · max {fmtNumber(stat?.max, sensor.decimals)}
        </span>
      </div>
    </div>
  )
}

export default function TvPage() {
  const [now, setNow] = useState<Date | null>(null)

  const latest = usePoll<LatestPayload>(apiPath(`/api/latest?device=${DEVICE}`), 10000)
  const stats = usePoll<StatsPayload>(apiPath(`/api/stats?device=${DEVICE}&range=24h`), 60000)
  const thresholdPoll = usePoll<{ thresholds: ThresholdMap }>(apiPath('/api/thresholds'), 120000)
  const health = usePoll<HealthPayload>(apiPath('/api/health'), 15000)
  const tvConfig = usePoll<{ config: { gases: SensorKey[] } }>(apiPath('/api/tv-config'), 60000)

  useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const values: Partial<Record<SensorKey, number>> = latest.data?.values ?? {}
  const thresholds = thresholdPoll.data?.thresholds ?? DEFAULT_THRESHOLDS
  const statsMap = stats.data?.stats ?? {}
  const online = health.data?.ok === true && latest.data?.timestamp != null

  const gasKeys = tvConfig.data?.config.gases ?? DEFAULT_TV_GASES
  const gasSensors = gasKeys.map((key) => SENSOR_MAP[key]).filter(Boolean)
  const gasCols =
    gasSensors.length <= 3
      ? Math.max(1, gasSensors.length)
      : gasSensors.length === 4
        ? 2
        : gasSensors.length <= 6
          ? 3
          : 4
  const gasRows = Math.max(1, Math.ceil(gasSensors.length / gasCols))
  const gasRemainder = gasSensors.length % gasCols

  const rightSensors: SensorDef[] = [SENSOR_MAP.pm25, SENSOR_MAP.pm10]

  return (
    <div className="flex h-screen w-screen flex-col gap-[0.9vw] overflow-hidden bg-page p-[0.9vw]">
      <header className="flex h-[9.5vh] shrink-0 items-center justify-between gap-[1vw] rounded-[10px] bg-surface px-[1.3vw] shadow-card">
        <div className="flex items-center gap-[0.8vw]">
          {TV_LOGOS.map((logo, index) => (
            <Fragment key={logo.file}>
              {index > 0 ? <span className="h-[4.5vh] w-px bg-line" /> : null}
              <div className="h-[5.8vh]" style={{ width: logo.width }}>
                <LogoSlot file={logo.file} name={logo.name} caption={logo.caption} size="tv" />
              </div>
            </Fragment>
          ))}
        </div>

        <div className="text-center">
          <p className="text-[1.45vw] font-extrabold uppercase leading-tight tracking-[0.14em] text-ink">
            Pemantauan Kualitas Udara
          </p>
          <p className="text-[0.95vw] font-semibold uppercase tracking-[0.34em] text-muted">
            Gas · Partikulat · SO2
          </p>
        </div>

        <div className="text-right">
          <p className="tnum text-[2.05vw] font-extrabold leading-none text-ink">
            {fmtClock(now ?? new Date())}
          </p>
          <div className="mt-[0.5vh] flex items-center justify-end gap-[0.45vw]">
            <span
              className={`h-[0.8vh] w-[0.8vh] rounded-full ${
                online ? 'bg-success live-dot' : 'bg-danger'
              }`}
            />
            <span
              className={`text-[0.9vw] font-semibold uppercase tracking-wide ${
                online ? 'text-success-ink' : 'text-danger-ink'
              }`}
            >
              {online ? 'Terhubung' : 'Terputus'}
            </span>
            <span className="text-[0.9vw] font-medium text-muted">
              · {fmtAge(latest.data?.age_seconds)}
            </span>
          </div>
          <p className="text-[0.85vw] font-medium text-muted">{fmtDate(now ?? new Date())}</p>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[2.06fr_1fr] gap-[0.9vw]">
        <section
          className="grid min-h-0 gap-[0.9vw]"
          style={{
            gridTemplateColumns: `repeat(${gasCols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${gasRows}, minmax(0, 1fr))`,
          }}
        >
          {gasSensors.length === 0 ? (
            <div
              className="grid place-items-center rounded-[10px] bg-surface text-[1.4vw] font-semibold text-muted shadow-card"
              style={{ gridColumn: '1 / -1' }}
            >
              Belum ada gas dipilih di Layout TV
            </div>
          ) : (
            gasSensors.map((sensor, index) => {
              const span =
                index === gasSensors.length - 1 && gasRemainder !== 0
                  ? gasCols - gasRemainder + 1
                  : 1
              return (
                <div key={sensor.key} className="min-h-0" style={{ gridColumn: `span ${span}` }}>
                  <TvCard
                    sensor={sensor}
                    value={values[sensor.key]}
                    threshold={thresholds[sensor.key]}
                    stat={statsMap[sensor.key]}
                    large={gasRows <= 2}
                  />
                </div>
              )
            })
          )}
        </section>

        <section
          className="grid min-h-0 gap-[0.9vw]"
          style={{ gridTemplateRows: `repeat(${rightSensors.length}, minmax(0, 1fr))` }}
        >
          {rightSensors.map((sensor) => (
            <TvCard
              key={sensor.key}
              sensor={sensor}
              value={values[sensor.key]}
              threshold={thresholds[sensor.key]}
              stat={statsMap[sensor.key]}
            />
          ))}
        </section>
      </main>

      <div className="shrink-0">
        <AlarmBanner values={values} thresholds={thresholds} variant="tv" />
      </div>
    </div>
  )
}
