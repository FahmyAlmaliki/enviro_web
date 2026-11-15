import 'server-only'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { SensorKey, ThresholdMap } from './sensors'
import { DEFAULT_THRESHOLDS } from './thresholds'

const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), 'data')
const filePath = path.join(dataDir, 'thresholds.json')

export async function readThresholds(): Promise<ThresholdMap> {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw) as Partial<ThresholdMap>
    const merged = { ...DEFAULT_THRESHOLDS }
    for (const key of Object.keys(DEFAULT_THRESHOLDS) as SensorKey[]) {
      const entry = parsed[key]
      if (entry && Number.isFinite(entry.warn) && Number.isFinite(entry.danger)) {
        merged[key] = { warn: entry.warn, danger: entry.danger }
      }
    }
    return merged
  } catch {
    return { ...DEFAULT_THRESHOLDS }
  }
}

export async function writeThresholds(thresholds: ThresholdMap): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(thresholds, null, 2), 'utf8')
}
