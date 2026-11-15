import type { Level, SensorDef, StatEntry, Threshold } from '@/lib/sensors'
import { fmtNumber } from '@/lib/format'
import { levelOf } from '@/lib/thresholds'
import { StatusBadge } from './status-badge'

const ACCENT: Record<Level, string> = {
  normal: 'bg-success',
  warn: 'bg-warning',
  danger: 'bg-danger',
  unknown: 'bg-line',
}

const VALUE_COLOR: Record<Level, string> = {
  normal: 'text-ink',
  warn: 'text-warning-ink',
  danger: 'text-danger-ink',
  unknown: 'text-muted',
}

interface Props {
  sensor: SensorDef
  value: number | undefined
  threshold: Threshold | undefined
  stat?: StatEntry
}

export function SensorCard({ sensor, value, threshold, stat }: Props) {
  const level = levelOf(value, threshold)

  return (
    <div className="relative overflow-hidden rounded-card bg-surface p-5 shadow-card">
      <span className={`absolute inset-x-0 top-0 h-[3px] ${ACCENT[level]}`} aria-hidden />

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px] text-[11px] font-extrabold"
            style={{ backgroundColor: `${sensor.color}1a`, color: sensor.color }}
          >
            {sensor.label.slice(0, 2)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">{sensor.label}</p>
            <p className="truncate text-[11px] text-muted">{sensor.name}</p>
          </div>
        </div>
        <StatusBadge level={level} />
      </div>

      <div className="mt-4 flex items-end gap-1.5">
        <span className={`tnum text-[34px] font-extrabold leading-none ${VALUE_COLOR[level]}`}>
          {fmtNumber(value, sensor.decimals)}
        </span>
        <span className="pb-1 text-xs font-medium text-muted">{sensor.unit}</span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted">AVG</p>
          <p className="tnum text-xs font-semibold text-ink">{fmtNumber(stat?.avg, sensor.decimals)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted">MIN</p>
          <p className="tnum text-xs font-semibold text-ink">{fmtNumber(stat?.min, sensor.decimals)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted">MAX</p>
          <p className="tnum text-xs font-semibold text-ink">{fmtNumber(stat?.max, sensor.decimals)}</p>
        </div>
      </div>
    </div>
  )
}
