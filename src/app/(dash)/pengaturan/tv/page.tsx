'use client'

import { useEffect, useState } from 'react'
import type { SensorKey } from '@/lib/sensors'
import { DEFAULT_TV_GASES, SENSOR_MAP, TV_GAS_KEYS } from '@/lib/sensors'
import { apiPath, fetchJson } from '@/lib/client-api'

interface Response {
  config: { gases: SensorKey[] }
  available: SensorKey[]
  defaults: { gases: SensorKey[] }
}

export default function TvSettingsPage() {
  const [selected, setSelected] = useState<SensorKey[]>(DEFAULT_TV_GASES)
  const [available, setAvailable] = useState<SensorKey[]>(TV_GAS_KEYS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    let alive = true
    fetchJson<Response>('/api/tv-config')
      .then((data) => {
        if (!alive) return
        setSelected(data.config.gases)
        setAvailable(data.available)
      })
      .catch((error: Error) => {
        if (alive) setMessage({ type: 'error', text: error.message })
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  function toggle(key: SensorKey) {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    )
    setMessage(null)
  }

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      const data = await fetchJson<{ config: { gases: SensorKey[] } }>('/api/tv-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gases: selected }),
      })
      setSelected(data.config.gases)
      setMessage({ type: 'ok', text: 'Layout videotron disimpan. Layar TV akan mengikuti otomatis.' })
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Gagal menyimpan',
      })
    } finally {
      setSaving(false)
    }
  }

  const ordered = available.filter((key) => selected.includes(key))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
            Videotron
          </p>
          <h2 className="text-xl font-bold text-ink">Layout Mode TV</h2>
          <p className="text-xs text-muted">
            Pilih gas yang muncul di layar besar. Partikulat PM2.5 dan PM10 selalu tampil.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setSelected([...available])
              setMessage(null)
            }}
            className="rounded-[6px] border border-line bg-surface px-3 py-2 text-xs font-semibold text-body hover:border-primary hover:text-primary"
          >
            Pilih Semua
          </button>
          <button
            type="button"
            onClick={() => {
              setSelected([])
              setMessage(null)
            }}
            className="rounded-[6px] border border-line bg-surface px-3 py-2 text-xs font-semibold text-body hover:border-primary hover:text-primary"
          >
            Kosongkan
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || loading}
            className="rounded-[6px] bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
          >
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </div>

      {message ? (
        <div
          className={`rounded-card px-4 py-2.5 text-xs font-semibold ${
            message.type === 'ok' ? 'bg-success-soft text-success-ink' : 'bg-danger-soft text-danger-ink'
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-card bg-surface shadow-card">
          <div className="border-b border-line px-5 py-4">
            <h3 className="text-sm font-bold text-ink">Pilih Gas</h3>
            <p className="text-[11px] text-muted">
              {ordered.length} dari {available.length} gas dipilih
            </p>
          </div>
          <div className="divide-y divide-line/70">
            {available.map((key) => {
              const sensor = SENSOR_MAP[key]
              const active = selected.includes(key)
              return (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-page/50"
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggle(key)}
                    className="h-4 w-4 accent-[#1e6fd9]"
                  />
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: sensor.color }}
                  />
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-ink">{sensor.label}</span>
                    <span className="block text-[11px] text-muted">
                      {sensor.name} · {sensor.unit}
                    </span>
                  </span>
                  {active ? (
                    <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      Tampil
                    </span>
                  ) : null}
                </label>
              )
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-card bg-surface p-5 shadow-card">
            <h3 className="text-sm font-bold text-ink">Pratinjau</h3>
            <p className="mt-1 text-[11px] text-muted">
              Kartu gas di videotron akan mengikuti urutan ini.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ordered.length === 0 ? (
                <span className="text-xs text-muted">Belum ada gas dipilih.</span>
              ) : (
                ordered.map((key) => {
                  const sensor = SENSOR_MAP[key]
                  return (
                    <span
                      key={key}
                      className="rounded-full px-3 py-1 text-[11px] font-semibold"
                      style={{ backgroundColor: `${sensor.color}1a`, color: sensor.color }}
                    >
                      {sensor.label}
                    </span>
                  )
                })
              )}
            </div>
            <div className="mt-4 border-t border-line pt-3 text-[11px] text-muted">
              Tetap tampil: <span className="font-semibold text-ink">PM2.5</span> dan{' '}
              <span className="font-semibold text-ink">PM10</span>
            </div>
          </div>

          <div className="rounded-card bg-primary-50 p-4 text-[11px] leading-relaxed text-body">
            Perubahan langsung dipakai halaman <code className="font-mono text-ink">/enviro/tv</code>{' '}
            pada refresh berikutnya (maksimal 30 detik), tanpa perlu restart.
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted">
        Tip: 6 gas membuat angka paling besar. Bila memilih 7–8 gas, kartu menyesuaikan
        otomatis agar tetap terbaca.
      </p>
    </div>
  )
}
