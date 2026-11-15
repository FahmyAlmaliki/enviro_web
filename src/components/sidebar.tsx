'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BASE_PATH } from '@/lib/client-api'

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/riwayat', label: 'Riwayat Data' },
  { href: '/pengaturan', label: 'Pengaturan Ambang' },
  { href: '/pengaturan/tv', label: 'Layout TV' },
]

function normalizedPath(raw: string | null): string {
  if (!raw) return '/'
  if (BASE_PATH && raw.startsWith(BASE_PATH)) {
    const rest = raw.slice(BASE_PATH.length)
    return rest === '' ? '/' : rest
  }
  return raw
}

export function Sidebar() {
  const pathname = normalizedPath(usePathname())

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col bg-surface shadow-card lg:flex">
      <div className="flex h-[72px] items-center gap-3 border-b border-line px-6">
        <div className="grid h-9 w-9 place-items-center rounded-[6px] bg-primary text-sm font-extrabold text-white">
          EM
        </div>
        <div className="leading-tight">
          <p className="text-[15px] font-bold text-ink">Enviro Monitor</p>
          <p className="text-[11px] text-muted">AI Center UB</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Menu</p>
        {NAV.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-[6px] px-3 py-2.5 text-sm transition-colors ${
                active
                  ? 'bg-primary-50 font-semibold text-primary'
                  : 'text-body hover:bg-page hover:text-ink'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-primary' : 'bg-line'}`}
                aria-hidden
              />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="m-3 rounded-card bg-primary-50 p-4">
        <p className="text-[11px] font-bold text-primary">Mode Videotron</p>
        <p className="mt-1 text-[11px] leading-relaxed text-body">
          Tampilan layar besar tanpa navigasi, dirancang untuk 1920×1080.
        </p>
        <Link
          href="/tv"
          className="mt-3 inline-flex w-full items-center justify-center rounded-[6px] bg-primary px-3 py-2 text-[11px] font-semibold text-white hover:bg-primary-600"
        >
          Buka Mode TV
        </Link>
      </div>
    </aside>
  )
}

export function MobileNav() {
  const pathname = normalizedPath(usePathname())
  return (
    <nav className="flex gap-2 overflow-x-auto lg:hidden">
      {NAV.map((item) => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
              active ? 'bg-primary text-white' : 'bg-page text-body'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
