export const TIME_ZONE = 'Asia/Jakarta'

const numberFormatCache = new Map<number, Intl.NumberFormat>()

export function fmtNumber(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  let fmt = numberFormatCache.get(decimals)
  if (!fmt) {
    fmt = new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    numberFormatCache.set(decimals, fmt)
  }
  return fmt.format(value)
}

export function fmtClock(value: Date | string | number = new Date()): string {
  const date = value instanceof Date ? value : new Date(value)
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

export function fmtDate(value: Date | string | number = new Date()): string {
  const date = value instanceof Date ? value : new Date(value)
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function fmtDateTime(value: Date | string | number = new Date()): string {
  const date = value instanceof Date ? value : new Date(value)
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

export function fmtTableTime(value: Date | string | number = new Date()): string {
  return fmtDateTime(value).replace(/,\s*/, ' · ')
}

export function fmtAge(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return 'belum ada data'
  if (seconds < 5) return 'baru saja'
  if (seconds < 60) return `${Math.round(seconds)} detik lalu`
  if (seconds < 3600) return `${Math.round(seconds / 60)} menit lalu`
  if (seconds < 86400) return `${Math.round(seconds / 3600)} jam lalu`
  return `${Math.round(seconds / 86400)} hari lalu`
}

export const RANGE_OPTIONS = [
  { value: '1h', label: '1 Jam' },
  { value: '6h', label: '6 Jam' },
  { value: '24h', label: '24 Jam' },
  { value: '7d', label: '7 Hari' },
  { value: '30d', label: '30 Hari' },
]

export function rangeToFlux(range: string): string {
  switch (range) {
    case '1h':
      return '-1h'
    case '6h':
      return '-6h'
    case '7d':
      return '-7d'
    case '30d':
      return '-30d'
    case '24h':
    default:
      return '-24h'
  }
}

export function rangeToInterval(range: string): string {
  switch (range) {
    case '1h':
      return '30s'
    case '6h':
      return '2m'
    case '7d':
      return '15m'
    case '30d':
      return '1h'
    case '24h':
    default:
      return '5m'
  }
}

export function rangeLabel(range: string): string {
  return RANGE_OPTIONS.find((r) => r.value === range)?.label ?? range
}
