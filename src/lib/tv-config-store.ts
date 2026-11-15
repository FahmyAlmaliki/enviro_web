import 'server-only'
import fs from 'node:fs/promises'
import path from 'node:path'
import {
  DEFAULT_TV_GASES,
  TV_GAS_KEYS,
  type SensorKey,
} from './sensors'

export interface TvConfig {
  gases: SensorKey[]
}

export const DEFAULT_TV_CONFIG: TvConfig = { gases: DEFAULT_TV_GASES }

const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), 'data')
const filePath = path.join(dataDir, 'tv-config.json')

export async function readTvConfig(): Promise<TvConfig> {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw) as Partial<TvConfig>
    if (Array.isArray(parsed.gases)) {
      const gases = parsed.gases.filter(
        (key): key is SensorKey =>
          typeof key === 'string' && TV_GAS_KEYS.includes(key as SensorKey),
      )
      return { gases }
    }
  } catch {
    // file belum ada, pakai default
  }
  return { gases: [...DEFAULT_TV_CONFIG.gases] }
}

export async function writeTvConfig(config: TvConfig): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf8')
}
