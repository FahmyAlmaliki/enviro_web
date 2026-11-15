import type { Level } from '@/lib/sensors'
import { LEVEL_TEXT } from '@/lib/thresholds'

const STYLES: Record<Level, string> = {
  normal: 'bg-success-soft text-success-ink',
  warn: 'bg-warning-soft text-warning-ink',
  danger: 'bg-danger-soft text-danger-ink',
  unknown: 'bg-page text-muted',
}

interface Props {
  level: Level
  size?: 'sm' | 'md' | 'tv'
  label?: string
}

export function StatusBadge({ level, size = 'sm', label }: Props) {
  const sizes = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
    tv: 'px-[0.9vw] py-[0.5vh] text-[1.05vw]',
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${STYLES[level]} ${sizes[size]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label ?? LEVEL_TEXT[level]}
    </span>
  )
}
