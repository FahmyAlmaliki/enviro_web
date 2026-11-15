'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { apiPath, BASE_PATH } from '@/lib/client-api'
import { fmtClock, fmtDate, fmtAge } from '@/lib/format'
import { usePoll } from '@/lib/use-poll'
import type { HealthPayload } from '@/lib/sensors'
import { MobileNav } from './sidebar'

const TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/riwayat': 'Riwayat Data',
  '/pengaturan': 'Pengaturan Ambang',
  '/pengaturan/tv': 'Layout TV',
}

function normalizedPath(raw: string | null): string {
  if (!raw) return '/'
  if (BASE_PATH && raw.startsWith(BASE_PATH)) {
    const rest = raw.slice(BASE_PATH.length)
    return rest === '' ? '/' : rest
  }
  return raw
}

export function Navbar() {
  const pathname = normalizedPath(usePathname())
  const title = TITLES[pathname] ?? 'Dashboard'
  const [now, setNow] = useState<Date | null>(null)
  const health = usePoll<HealthPayload>(apiPath('/api/health'), 30000)

  useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const online = health.data?.ok === true
  const lastAge = health.data?.age_seconds

  return (
    <header className="sticky top-0 z-20 bg-page/90 px-4 pt-4 backdrop-blur lg:px-6">
      <div className="rounded-card bg-surface px-4 py-3 shadow-card-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] text-muted">
              <Link href="/" className="hover:text-primary">
                Enviro
              </Link>{' '}
              / {title}
            </p>
            <h1 className="text-lg font-bold text-ink">{title}</h1>
          </div>

          <div className="flex items-center gap-2.5">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                online ? 'bg-success-soft text-success-ink' : 'bg-danger-soft text-danger-ink'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${online ? 'bg-success live-dot' : 'bg-danger'}`}
              />
              {online ? 'Terhubung' : 'Terputus'}
            </span>
            <span className="hidden rounded-full bg-page px-3 py-1.5 text-[11px] font-medium text-body sm:inline">
              {fmtDate(now ?? new Date())} · {fmtClock(now ?? new Date())} WIB
            </span>
            <Link
              href="/tv"
              className="rounded-[6px] bg-primary px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-primary-600"
            >
              Mode TV
            </Link>
          </div>
        </div>

        <div className="mt-3 lg:hidden">
          <MobileNav />
        </div>

        {!health.loading && lastAge !== undefined && lastAge !== null ? (
          <p className="mt-1 text-[10px] text-muted">Data terakhir: {fmtAge(lastAge)}</p>
        ) : null}
      </div>
    </header>
  )
}
