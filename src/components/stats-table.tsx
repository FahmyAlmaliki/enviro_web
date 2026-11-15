import type { SensorKey, StatEntry, ThresholdMap } from '@/lib/sensors'
import { ALARM_KEYS, SENSOR_MAP } from '@/lib/sensors'
import { fmtNumber } from '@/lib/format'
import { levelOf } from '@/lib/thresholds'
import { StatusBadge } from './status-badge'

interface Props {
  stats: Partial<Record<SensorKey, StatEntry>>
  thresholds: ThresholdMap
  rangeLabel: string
}

export function StatsTable({ stats, thresholds, rangeLabel }: Props) {
  return (
    <div className="rounded-card bg-surface shadow-card">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <h2 className="text-sm font-bold text-ink">Statistik Sensor</h2>
          <p className="text-[11px] text-muted">Rentang {rangeLabel} · status dari nilai maksimum</p>
        </div>
        <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[10px] font-semibold text-primary">
          AVG · MIN · MAX
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-xs">
          <thead>
            <tr className="bg-page/70 text-[10px] uppercase tracking-wide text-muted">
              <th className="px-5 py-2.5 font-semibold">Sensor</th>
              <th className="px-3 py-2.5 text-right font-semibold">AVG</th>
              <th className="px-3 py-2.5 text-right font-semibold">MIN</th>
              <th className="px-3 py-2.5 text-right font-semibold">MAX</th>
              <th className="px-5 py-2.5 text-right font-semibold">Status (MAX)</th>
            </tr>
          </thead>
          <tbody>
            {ALARM_KEYS.map((key) => {
              const sensor = SENSOR_MAP[key]
              const stat = stats[sensor.key]
              const level = levelOf(stat?.max, thresholds[sensor.key])
              return (
                <tr key={sensor.key} className="border-t border-line/70 hover:bg-page/50">
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: sensor.color }}
                      />
                      <span className="font-semibold text-ink">{sensor.label}</span>
                      <span className="text-[10px] text-muted">{sensor.unit}</span>
                    </div>
                  </td>
                  <td className="tnum px-3 py-2.5 text-right font-medium text-ink">
                    {fmtNumber(stat?.avg, sensor.decimals)}
                  </td>
                  <td className="tnum px-3 py-2.5 text-right text-body">
                    {fmtNumber(stat?.min, sensor.decimals)}
                  </td>
                  <td className="tnum px-3 py-2.5 text-right text-body">
                    {fmtNumber(stat?.max, sensor.decimals)}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <StatusBadge level={level} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
