'use client'

import { useEffect, useState } from 'react'
import type { SensorKey, ThresholdMap } from '@/lib/sensors'
import { ALARM_KEYS, SENSOR_MAP } from '@/lib/sensors'
import { DEFAULT_THRESHOLDS } from '@/lib/thresholds'
import { apiPath, fetchJson } from '@/lib/client-api'

interface Response {
  thresholds: ThresholdMap
  defaults: ThresholdMap
}

export default function PengaturanPage() {
  const [draft, setDraft] = useState<ThresholdMap>(DEFAULT_THRESHOLDS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    let alive = true
    fetchJson<Response>('/api/thresholds')
      .then((data) => {
        if (alive) setDraft(data.thresholds)
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

  function update(key: SensorKey, field: 'warn' | 'danger', raw: string) {
    const value = Number(raw)
    setDraft((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: Number.isFinite(value) ? Math.max(0, value) : 0 },
    }))
    setMessage(null)
  }

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      const data = await fetchJson<{ thresholds: ThresholdMap }>('/api/thresholds', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      setDraft(data.thresholds)
      setMessage({ type: 'ok', text: 'Ambang batas berhasil disimpan.' })
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Gagal menyimpan',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
            Konfigurasi Alarm
          </p>
          <h2 className="text-xl font-bold text-ink">Pengaturan Ambang Batas</h2>
          <p className="text-xs text-muted">
            Nilai default hanyalah contoh. Sesuaikan dengan baku mutu yang berlaku di lokasi Anda.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setDraft({ ...DEFAULT_THRESHOLDS })
              setMessage(null)
            }}
            className="rounded-[6px] border border-line bg-surface px-3 py-2 text-xs font-semibold text-body hover:border-primary hover:text-primary"
          >
            Kembalikan Default
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
            message.type === 'ok'
              ? 'bg-success-soft text-success-ink'
              : 'bg-danger-soft text-danger-ink'
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-card bg-surface shadow-card">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="bg-page/70 text-[10px] uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-semibold">Sensor</th>
              <th className="px-3 py-3 font-semibold">Satuan</th>
              <th className="px-3 py-3 font-semibold">Batas Waspada</th>
              <th className="px-5 py-3 font-semibold">Batas Bahaya</th>
            </tr>
          </thead>
          <tbody>
            {ALARM_KEYS.map((key) => {
              const sensor = SENSOR_MAP[key]
              return (
              <tr key={sensor.key} className="border-t border-line/70">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: sensor.color }}
                    />
                    <span className="font-semibold text-ink">{sensor.label}</span>
                    <span className="text-[11px] text-muted">{sensor.name}</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-muted">{sensor.unit}</td>
                <td className="px-3 py-3">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={draft[sensor.key]?.warn ?? 0}
                    onChange={(event) => update(sensor.key, 'warn', event.target.value)}
                    className="tnum w-28 rounded-[6px] border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-warning"
                  />
                </td>
                <td className="px-5 py-3">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={draft[sensor.key]?.danger ?? 0}
                    onChange={(event) => update(sensor.key, 'danger', event.target.value)}
                    className="tnum w-28 rounded-[6px] border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-danger"
                  />
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] leading-relaxed text-muted">
        Ambang batas memengaruhi warna kartu, banner peringatan, dan penanda pada grafik. Perubahan
        langsung dipakai oleh dashboard operator maupun mode videotron setelah disimpan.
      </p>
    </div>
  )
}
