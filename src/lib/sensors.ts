export type SensorKey =
  | 'co'
  | 'ch4'
  | 'c2h5oh'
  | 'h2'
  | 'nh3'
  | 'no2'
  | 'pm1'
  | 'pm25'
  | 'pm4'
  | 'pm10'
  | 'so2_voltage'
  | 'so2_raw'
  | 'temp_sht'
  | 'humidity'
  | 'temp_bmp'
  | 'pressure'
  | 'altitude'

export type SensorGroup = 'gas' | 'pm' | 'so2' | 'env'

export interface SensorDef {
  key: SensorKey
  label: string
  name: string
  unit: string
  group: SensorGroup
  decimals: number
  color: string
}

export const SENSORS: SensorDef[] = [
  { key: 'co', label: 'CO', name: 'Karbon Monoksida', unit: 'ppm', group: 'gas', decimals: 2, color: '#1e6fd9' },
  { key: 'ch4', label: 'CH4', name: 'Metana', unit: 'ppm', group: 'gas', decimals: 2, color: '#0ba5ec' },
  { key: 'c2h5oh', label: 'C2H5OH', name: 'Etanol', unit: 'ppm', group: 'gas', decimals: 2, color: '#f79009' },
  { key: 'h2', label: 'H2', name: 'Hidrogen', unit: 'ppm', group: 'gas', decimals: 2, color: '#12b76a' },
  { key: 'nh3', label: 'NH3', name: 'Amonia', unit: 'ppm', group: 'gas', decimals: 2, color: '#f04438' },
  { key: 'no2', label: 'NO2', name: 'Nitrogen Dioksida', unit: 'ppm', group: 'gas', decimals: 2, color: '#667085' },
  { key: 'pm1', label: 'PM1.0', name: 'Partikulat 1.0 µm', unit: 'µg/m³', group: 'pm', decimals: 1, color: '#98a2b3' },
  { key: 'pm25', label: 'PM2.5', name: 'Partikulat 2.5 µm', unit: 'µg/m³', group: 'pm', decimals: 1, color: '#3b82f6' },
  { key: 'pm4', label: 'PM4.0', name: 'Partikulat 4.0 µm', unit: 'µg/m³', group: 'pm', decimals: 1, color: '#667085' },
  { key: 'pm10', label: 'PM10', name: 'Partikulat 10 µm', unit: 'µg/m³', group: 'pm', decimals: 1, color: '#0ba5ec' },
  { key: 'so2_voltage', label: 'SO2', name: 'Sulfur Dioksida (MQ-136)', unit: 'V', group: 'so2', decimals: 2, color: '#f79009' },
  { key: 'so2_raw', label: 'SO2 RAW', name: 'ADC MQ-136', unit: 'ADC', group: 'so2', decimals: 0, color: '#98a2b3' },
  { key: 'temp_sht', label: 'Suhu', name: 'SHT41', unit: '°C', group: 'env', decimals: 2, color: '#f79009' },
  { key: 'humidity', label: 'Kelembapan', name: 'SHT41', unit: '%', group: 'env', decimals: 2, color: '#0ba5ec' },
  { key: 'temp_bmp', label: 'Suhu BMP', name: 'BMP280', unit: '°C', group: 'env', decimals: 2, color: '#667085' },
  { key: 'pressure', label: 'Tekanan', name: 'BMP280', unit: 'hPa', group: 'env', decimals: 2, color: '#1e6fd9' },
  { key: 'altitude', label: 'Ketinggian', name: 'BMP280', unit: 'm', group: 'env', decimals: 2, color: '#475467' },
]

export const GAS_SENSORS = SENSORS.filter((s) => s.group === 'gas')
export const PM_SENSORS = SENSORS.filter((s) => s.group === 'pm')
export const SO2_VOLTAGE = SENSORS.find((s) => s.key === 'so2_voltage')!
export const SO2_RAW = SENSORS.find((s) => s.key === 'so2_raw')!
export const ENV_SENSORS = SENSORS.filter((s) => s.group === 'env')

/** Sensor yang punya ambang batas dan muncul di pengaturan alarm. */
export const ALARM_KEYS: SensorKey[] = [
  ...GAS_SENSORS.map((s) => s.key),
  ...PM_SENSORS.map((s) => s.key),
  'so2_voltage',
]

/** Pilihan gas yang bisa ditampilkan di videotron. */
export const TV_GAS_KEYS: SensorKey[] = [...GAS_SENSORS.map((s) => s.key), 'so2_voltage']

/** Pilihan awal videotron: enam gas MiCS-4514. */
export const DEFAULT_TV_GASES: SensorKey[] = GAS_SENSORS.map((s) => s.key)

export const SENSOR_MAP: Record<SensorKey, SensorDef> = SENSORS.reduce(
  (acc, s) => ({ ...acc, [s.key]: s }),
  {} as Record<SensorKey, SensorDef>,
)

export const SENSOR_KEYS = SENSORS.map((s) => s.key)

export type Level = 'normal' | 'warn' | 'danger' | 'unknown'

export interface LatestPayload {
  device_id: string
  timestamp: string | null
  age_seconds: number | null
  values: Partial<Record<SensorKey, number>>
}

export interface StatEntry {
  avg: number | null
  min: number | null
  max: number | null
}

export interface StatsPayload {
  device_id: string
  range: string
  from: string
  to: string
  stats: Partial<Record<SensorKey, StatEntry>>
}

export interface HistoryPayload {
  sensor: string
  unit: string
  points: Array<{ t: string; v: number }>
}

export interface ReadingsPayload {
  rows: Array<Record<string, number | string | null>>
}

export interface Threshold {
  warn: number
  danger: number
}

export type ThresholdMap = Record<SensorKey, Threshold>

export interface HealthPayload {
  ok: boolean
  influx: boolean
  last_reading: string | null
  age_seconds: number | null
  version: string
}
