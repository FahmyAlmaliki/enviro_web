'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface PollResult<T> {
  data: T | null
  error: string | null
  updatedAt: number | null
  loading: boolean
  refresh: () => void
}

export function usePoll<T>(url: string | null, intervalMs = 5000): PollResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const alive = useRef(true)

  const load = useCallback(async () => {
    if (!url) return
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) {
        let message = `HTTP ${res.status}`
        try {
          const body = await res.json()
          if (body?.error) message = body.error
        } catch {
          // ignore parse error
        }
        throw new Error(message)
      }
      const json = (await res.json()) as T
      if (!alive.current) return
      setData(json)
      setError(null)
      setUpdatedAt(Date.now())
    } catch (err) {
      if (!alive.current) return
      setError(err instanceof Error ? err.message : 'Gagal memuat data')
    } finally {
      if (alive.current) setLoading(false)
    }
  }, [url])

  useEffect(() => {
    alive.current = true
    setLoading(true)
    void load()
    const timer = setInterval(() => void load(), intervalMs)
    return () => {
      alive.current = false
      clearInterval(timer)
    }
  }, [load, intervalMs])

  return { data, error, updatedAt, loading, refresh: load }
}
