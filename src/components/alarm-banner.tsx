import type { SensorKey, ThresholdMap } from '@/lib/sensors'
import { SENSOR_MAP } from '@/lib/sensors'
import { levelOf } from '@/lib/thresholds'
import { fmtNumber } from '@/lib/format'

interface Props {
  values: Partial<Record<SensorKey, number>>
  thresholds: ThresholdMap
  variant?: 'dashboard' | 'tv'
}

export function AlarmBanner({ values, thresholds, variant = 'dashboard' }: Props) {
  const active = (Object.keys(values) as SensorKey[])
    .map((key) => {
      const value = values[key]
      const def = SENSOR_MAP[key]
      const level = levelOf(value, thresholds[key])
      return { key, value, def, level }
    })
    .filter((item) => item.level === 'warn' || item.level === 'danger')
    .sort((a, b) => (a.level === b.level ? 0 : a.level === 'danger' ? -1 : 1))

  const hasDanger = active.some((a) => a.level === 'danger')

  if (variant === 'tv') {
    if (active.length === 0) {
      return (
        <div className="flex h-[7vh] items-center justify-center gap-[1vw] rounded-[10px] bg-success-soft text-success-ink">
          <span className="h-[1.2vh] w-[1.2vh] rounded-full bg-success live-dot" />
          <span className="text-[1.6vw] font-bold">SEMUA SENSOR DALAM BATAS NORMAL</span>
        </div>
      )
    }
    return (
      <div
        className={`flex h-[7vh] items-center gap-[1.2vw] overflow-hidden rounded-[10px] px-[1.5vw] ${
          hasDanger ? 'bg-danger text-white' : 'bg-warning text-white'
        }`}
      >
        <span className="shrink-0 text-[1.3vw] font-extrabold uppercase tracking-wider">
          {hasDanger ? 'Bahaya' : 'Waspada'}
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-[1.6vw] whitespace-nowrap">
          {active.map((item) => (
            <span key={item.key} className="text-[1.4vw] font-bold">
              {item.def.label} {fmtNumber(item.value, item.def.decimals)} {item.def.unit}
            </span>
          ))}
        </div>
      </div>
    )
  }

  if (active.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-card bg-success-soft px-4 py-2.5 text-xs font-semibold text-success-ink">
        <span className="h-2 w-2 rounded-full bg-success live-dot" />
        Semua sensor dalam batas normal.
      </div>
    )
  }

  return (
    <div
      className={`rounded-card px-4 py-3 text-xs font-semibold ${
        hasDanger ? 'bg-danger-soft text-danger-ink' : 'bg-warning-soft text-warning-ink'
      }`}
    >
      <p className="mb-1 font-bold uppercase tracking-wide">
        {hasDanger ? 'Peringatan bahaya' : 'Peringatan waspada'}
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 font-medium">
        {active.map((item) => (
          <span key={item.key}>
            {item.def.label}: {fmtNumber(item.value, item.def.decimals)} {item.def.unit}
          </span>
        ))}
      </div>
    </div>
  )
}
