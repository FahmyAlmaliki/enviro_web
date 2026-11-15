'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReadingsPayload, SensorKey, ThresholdMap } from '@/lib/sensors'
import { GAS_SENSORS, PM_SENSORS, SO2_VOLTAGE } from '@/lib/sensors'
import { DEFAULT_THRESHOLDS, levelOf } from '@/lib/thresholds'
import { RANGE_OPTIONS, fmtTableTime, rangeLabel } from '@/lib/format'
import { apiPath } from '@/lib/client-api'
import { usePoll } from '@/lib/use-poll'
import { StatusBadge } from '@/components/status-badge'

const DEVICE = 'node-01'
const PAGE_SIZE = 50

function cellColor(level: string): string {
  if (level === 'danger') return 'text-danger-ink font-semibold'
  if (level === 'warn') return 'text-warning-ink font-semibold'
  return 'text-ink'
}

export default function RiwayatPage() {
  const [range, setRange] = useState('24h')
  const [page, setPage] = useState(0)

  const history = usePoll<ReadingsPayload>(
    apiPath(`/api/history?device=${DEVICE}&sensor=all&range=${range}&limit=500`),
    15000,
  )
  const thresholdPoll = usePoll<{ thresholds: ThresholdMap }>(apiPath('/api/thresholds'), 120000)
  const thresholds = thresholdPoll.data?.thresholds ?? DEFAULT_THRESHOLDS

  const rows = useMemo(() => history.data?.rows ?? [], [history.data])

  useEffect(() => {
    setPage(0)
  }, [range])

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const start = safePage * PAGE_SIZE
  const pageRows = rows.slice(start, start + PAGE_SIZE)

  const columns = [...GAS_SENSORS, ...PM_SENSORS]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
            Arsip Pengukuran
          </p>
          <h2 className="text-xl font-bold text-ink">Riwayat Data</h2>
          <p className="text-xs text-muted">
            {rows.length} baris · rentang {rangeLabel(range)} · perangkat {DEVICE} · waktu WIB
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
            title="CSV dipisah titik koma dan desimal koma, siap dibuka di Excel"
            className="rounded-[6px] bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary-600"
          >
            Unduh CSV
          </a>
        </div>
      </div>

      <div className="overflow-hidden rounded-card bg-surface shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
          <div>
            <h3 className="text-sm font-bold text-ink">Tabel Pengukuran</h3>
            <p className="text-[11px] text-muted">
              Desimal gas 2 angka, partikulat 1 angka
            </p>
          </div>
          <div className="flex items-center gap-3">
            {history.error ? <StatusBadge level="danger" label={history.error} /> : null}
            <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[10px] font-semibold text-primary">
              {history.loading ? 'Memuat…' : `${rows.length} baris`}
            </span>
          </div>
        </div>

        <div className="max-h-[68vh] overflow-auto">
          <table className="w-full min-w-[1080px] border-separate border-spacing-0 text-left text-xs">
            <thead className="sticky top-0 z-20">
              <tr className="text-[10px] tracking-wide text-muted">
                <th
                  rowSpan={2}
                  className="sticky left-0 z-30 border-b border-line bg-page px-5 py-2.5 text-left font-semibold"
                >
                  Waktu
                </th>
                <th
                  colSpan={GAS_SENSORS.length}
                  className="border-b border-l border-line bg-page px-3 py-2 text-center font-semibold"
                >
                  Gas (ppm)
                </th>
                <th
                  colSpan={1}
                  className="border-b border-l border-line bg-page px-3 py-2 text-center font-semibold"
                >
                  SO2 (V)
                </th>
                <th
                  colSpan={PM_SENSORS.length}
                  className="border-b border-l border-line bg-page px-3 py-2 text-center font-semibold"
                >
                  Partikulat SPS30 (µg/m³)
                </th>
              </tr>
              <tr className="text-[10px] font-semibold text-muted">
                {GAS_SENSORS.map((sensor, index) => (
                  <th
                    key={sensor.key}
                    className={`border-b border-line bg-page px-3 py-2 text-right ${
                      index === 0 ? 'border-l' : ''
                    }`}
                  >
                    {sensor.label}
                  </th>
                ))}
                <th className="border-b border-l border-line bg-page px-3 py-2 text-right">
                  SO2
                </th>
                {PM_SENSORS.map((sensor, index) => (
                  <th
                    key={sensor.key}
                    className={`border-b border-line bg-page px-3 py-2 text-right ${
                      index === 0 ? 'border-l' : ''
                    }`}
                  >
                    {sensor.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + 2}
                    className="px-5 py-12 text-center text-muted"
                  >
                    {history.loading ? 'Memuat data…' : 'Belum ada data pada rentang ini.'}
                  </td>
                </tr>
              ) : (
                pageRows.map((row, index) => (
                  <tr
                    key={`${row.time}-${index}`}
                    className={`group transition-colors ${
                      index % 2 === 0 ? 'bg-surface' : 'bg-page/45'
                    } hover:bg-primary-50/60`}
                  >
                    <td className="tnum sticky left-0 z-10 whitespace-nowrap border-b border-line/60 bg-[inherit] px-5 py-2 font-medium text-ink">
                      {row.time ? fmtTableTime(String(row.time)) : '—'}
                    </td>

                    {GAS_SENSORS.map((sensor, cellIndex) => {
                      const value = row[sensor.key]
                      const numeric = typeof value === 'number' ? value : null
                      const level = levelOf(numeric, thresholds[sensor.key as SensorKey])
                      return (
                        <td
                          key={sensor.key}
                          className={`tnum border-b border-line/60 px-3 py-2 text-right ${
                            cellIndex === 0 ? 'border-l border-line/60' : ''
                          } ${cellColor(level)}`}
                        >
                          {numeric === null ? '—' : numeric.toFixed(sensor.decimals)}
                        </td>
                      )
                    })}

                    <td className="tnum border-b border-l border-line/60 px-3 py-2 text-right">
                      {(() => {
                        const value = row[SO2_VOLTAGE.key]
                        const numeric = typeof value === 'number' ? value : null
                        const level = levelOf(numeric, thresholds[SO2_VOLTAGE.key])
                        return (
                          <span className={cellColor(level)}>
                            {numeric === null ? '—' : numeric.toFixed(SO2_VOLTAGE.decimals)}
                          </span>
                        )
                      })()}
                    </td>

                    {PM_SENSORS.map((sensor, cellIndex) => {
                      const value = row[sensor.key]
                      const numeric = typeof value === 'number' ? value : null
                      const level = levelOf(numeric, thresholds[sensor.key as SensorKey])
                      return (
                        <td
                          key={sensor.key}
                          className={`tnum border-b border-line/60 px-3 py-2 text-right ${
                            cellIndex === 0 ? 'border-l border-line/60' : ''
                          } ${cellColor(level)}`}
                        >
                          {numeric === null ? '—' : numeric.toFixed(sensor.decimals)}
                        </td>
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
          <p className="text-[11px] text-muted">
            Menampilkan {rows.length === 0 ? 0 : start + 1}–{Math.min(start + PAGE_SIZE, rows.length)} dari{' '}
            {rows.length} baris
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              disabled={safePage === 0}
              className="rounded-[6px] border border-line bg-surface px-3 py-1.5 text-[11px] font-semibold text-body hover:border-primary hover:text-primary disabled:opacity-40"
            >
              Sebelumnya
            </button>
            <span className="text-[11px] font-semibold text-ink">
              {safePage + 1} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}
              disabled={safePage >= totalPages - 1}
              className="rounded-[6px] border border-line bg-surface px-3 py-1.5 text-[11px] font-semibold text-body hover:border-primary hover:text-primary disabled:opacity-40"
            >
              Berikutnya
            </button>
          </div>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-muted">
        CSV diekspor dengan pemisah titik koma dan desimal koma agar langsung terpisah rapi di
        Excel berbahasa Indonesia. Untuk CSV standar (koma + desimal titik), tambahkan
        <code className="mx-1 rounded bg-page px-1 py-0.5 font-mono text-[10px] text-ink">
          &amp;delimiter=,
        </code>
        pada tautan unduhan.
      </p>
    </div>
  )
}
