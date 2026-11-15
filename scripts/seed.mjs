const url = process.env.INGEST_URL ?? 'http://localhost:3000/enviro/api/ingest'
const apiKey = process.env.INGEST_API_KEY
const deviceId = process.env.DEVICE_ID ?? 'node-01'

if (!apiKey) {
  console.error('[seed] INGEST_API_KEY belum diisi')
  process.exit(1)
}

const HOURS = Number(process.env.SEED_HOURS ?? 24)
const STEP_SECONDS = Number(process.env.SEED_STEP ?? 90)
const BATCH = 200

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

function step(key) {
  const base = baseline[key]
  const drift = (Math.random() - 0.5) * base * 0.3
  let next = state[key] + drift + (base - state[key]) * 0.1
  if (Math.random() < 0.004) next = base * (4 + Math.random() * 8)
  next = Math.max(0, next)
  state[key] = Number(next.toFixed(3))
  return state[key]
}

function readingAt(time) {
  return {
    device_id: deviceId,
    timestamp: time.toISOString(),
    gases: {
      co: step('co'),
      ch4: step('ch4'),
      c2h5oh: step('c2h5oh'),
      h2: step('h2'),
      nh3: step('nh3'),
      no2: step('no2'),
    },
    sps30: {
      pm1: step('pm1'),
      pm25: step('pm25'),
      pm4: step('pm4'),
      pm10: step('pm10'),
    },
    so2: step('so2'),
  }
}

function buildReadings() {
  const now = Date.now()
  const total = Math.floor((HOURS * 3600) / STEP_SECONDS)
  const readings = []
  for (let i = total; i >= 0; i -= 1) {
    const time = new Date(now - i * STEP_SECONDS * 1000)
    readings.push(readingAt(time))
  }
  return readings
}

function chunk(array, size) {
  const chunks = []
  for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size))
  return chunks
}

async function postBatch(readings) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({ readings }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

async function main() {
  const readings = buildReadings()
  const batches = chunk(readings, BATCH)
  console.log(
    `[seed] ${readings.length} titik (${HOURS} jam, tiap ${STEP_SECONDS}s) dalam ${batches.length} batch → ${url}`,
  )
  let written = 0
  for (const [index, batch] of batches.entries()) {
    const result = await postBatch(batch)
    written += result.written ?? batch.length
    process.stdout.write(`\r[seed] ${index + 1}/${batches.length} batch · ${written} titik`)
  }
  console.log(`\n[seed] selesai: ${written} titik terkirim`)
}

main().catch((error) => {
  console.error(`\n[seed] gagal: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
