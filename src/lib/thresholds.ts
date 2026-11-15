import type { Level, SensorKey, Threshold, ThresholdMap } from './sensors'

export const DEFAULT_THRESHOLDS: ThresholdMap = {
  co: { warn: 25, danger: 50 },
  ch4: { warn: 1000, danger: 5000 },
  c2h5oh: { warn: 1000, danger: 1900 },
  h2: { warn: 1000, danger: 4000 },
  nh3: { warn: 25, danger: 35 },
  no2: { warn: 3, danger: 5 },
  pm1: { warn: 15, danger: 35 },
  pm25: { warn: 35, danger: 55 },
  pm4: { warn: 40, danger: 80 },
  pm10: { warn: 50, danger: 150 },
  so2_voltage: { warn: 3, danger: 4 },
  so2_raw: { warn: 30000, danger: 40000 },
  temp_sht: { warn: 45, danger: 55 },
  humidity: { warn: 90, danger: 98 },
  temp_bmp: { warn: 45, danger: 55 },
  pressure: { warn: 1050, danger: 1100 },
  altitude: { warn: 3000, danger: 4000 },
}

export const THRESHOLD_LABELS: Record<SensorKey, string> = {
  co: 'CO',
  ch4: 'CH4',
  c2h5oh: 'C2H5OH',
  h2: 'H2',
  nh3: 'NH3',
  no2: 'NO2',
  pm1: 'PM1.0',
  pm25: 'PM2.5',
  pm4: 'PM4.0',
  pm10: 'PM10',
  so2_voltage: 'SO2 (V)',
  so2_raw: 'SO2 RAW',
  temp_sht: 'Suhu SHT41',
  humidity: 'Kelembapan',
  temp_bmp: 'Suhu BMP280',
  pressure: 'Tekanan',
  altitude: 'Ketinggian',
}

export function levelOf(value: number | null | undefined, threshold: Threshold | undefined): Level {
  if (value === null || value === undefined || Number.isNaN(value)) return 'unknown'
  if (!threshold) return 'normal'
  if (value >= threshold.danger) return 'danger'
  if (value >= threshold.warn) return 'warn'
  return 'normal'
}

export const LEVEL_TEXT: Record<Level, string> = {
  normal: 'Normal',
  warn: 'Waspada',
  danger: 'Bahaya',
  unknown: 'Tidak ada data',
}
