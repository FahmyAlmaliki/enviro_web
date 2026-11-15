const url = process.env.INGEST_URL ?? 'http://localhost:3000/enviro/api/ingest'
const apiKey = process.env.INGEST_API_KEY
const intervalMs = Number(process.env.INTERVAL_MS ?? 5000)
const deviceId = process.env.DEVICE_ID ?? 'node-01'

if (!apiKey) {
  console.error('[simulator] INGEST_API_KEY belum diisi')
  process.exit(1)
}

const baseline = {
  co: 2,
  ch4: 4,
  c2h5oh: 3,
  h2: 1.5,
  nh3: 1,
  no2: 0.2,
  pm1: 4,
  pm25: 8,
  pm4: 12,
  pm10: 18,
  so2: 0.1,
}

const state = { ...baseline }
const spikeLimits = { co: 60, ch4: 6000, c2h5oh: 2200, h2: 4500, nh3: 40, no2: 6, so2: 6 }
let tick = 0

function step(key, value) {
  const base = baseline[key]
  const drift = (Math.random() - 0.5) * base * 0.25
  let next = value + drift + (base - value) * 0.08

  if (key in spikeLimits && Math.random() < 0.012) {
    next = spikeLimits[key] * (0.85 + Math.random() * 0.5)
  }

  if (key.startsWith('pm')) {
    next = Math.max(0, next)
  } else {
    next = Math.max(0, next)
  }
  return Number(next.toFixed(3))
}

async function send() {
  tick += 1
  for (const key of Object.keys(state)) {
    state[key] = step(key, state[key])
  }

  const payload = {
    device_id: deviceId,
    timestamp: new Date().toISOString(),
    gases: {
      co: state.co,
      ch4: state.ch4,
      c2h5oh: state.c2h5oh,
      h2: state.h2,
      nh3: state.nh3,
      no2: state.no2,
    },
    sps30: { pm1: state.pm1, pm25: state.pm25, pm4: state.pm4, pm10: state.pm10 },
    so2: state.so2,
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error(`[simulator] HTTP ${res.status}: ${text.slice(0, 200)}`)
    } else if (tick % 12 === 0) {
      console.log(`[simulator] terkirim #${tick} CO=${state.co} PM2.5=${state.pm25}`)
    }
  } catch (error) {
    console.error(`[simulator] gagal: ${error instanceof Error ? error.message : error}`)
  }
}

console.log(`[simulator] mulai → ${url} setiap ${intervalMs} ms`)
void send()
setInterval(() => void send(), intervalMs)
