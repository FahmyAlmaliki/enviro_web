interface Entry {
  expires: number
  value: unknown
}

const store = new Map<string, Entry>()

/**
 * Cache in-memory sederhana untuk hasil query InfluxDB.
 * Berguna agar banyak klien yang polling tidak memicu query berulang.
 */
export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const hit = store.get(key)
  if (hit && hit.expires > now) {
    return hit.value as T
  }
  const value = await loader()
  store.set(key, { expires: now + ttlMs, value })
  return value
}
