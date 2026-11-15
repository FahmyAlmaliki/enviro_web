export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '/enviro'

export function apiPath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (!BASE_PATH) return normalized
  return `${BASE_PATH}${normalized}`
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiPath(path), { cache: 'no-store', ...init })
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const body = await res.json()
      if (body?.error) message = body.error
    } catch {
      // ignore
    }
    throw new Error(message)
  }
  return (await res.json()) as T
}
