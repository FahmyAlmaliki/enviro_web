# Node Sensor — Enviro Monitor

Klien Python untuk mengirim data sensor ke `POST /enviro/api/ingest`.

Hanya memakai pustaka standar Python, kecuali mode serial (`pyserial`).
Mendukung antrean offline: data tetap tersimpan saat jaringan putus dan
dikirim ulang otomatis ketika tersambung.

## Format data

API menerima JSON datar maupun bersarang:

```json
{
  "co": 1.8,
  "ch4": 3.4,
  "c2h5oh": 2.1,
  "h2": 1.1,
  "nh3": 0.8,
  "no2": 0.2,
  "pm1": 4.0,
  "pm25": 8.1,
  "pm4": 12.0,
  "pm10": 18.2,
  "so2_voltage": 0.5,
  "so2_raw": 4989
}
```

Satuan: gas dalam **ppm**, SO2 berupa **voltase (V) + RAW ADC**, partikulat **µg/m³**.

## Mulai cepat (tanpa hardware)

```bash
cd node
python3 enviro_node.py --source mock --once --print
```

Kirim ke server:

```bash
cp node.env.example node.env
# isi ENVIRO_API_KEY
set -a && . ./node.env && set +a
python3 enviro_node.py --source mock --once
```

## Mode serial (Arduino/ESP32)

Node menerima **satu objek JSON per baris** dari port serial:

```json
{"co":1.8,"ch4":3.4,"pm1":4.0,"pm25":8.1,"pm4":12.0,"pm10":18.2,"so2_voltage":0.5}
```

```bash
pip install pyserial
python3 enviro_node.py --source serial --serial-port /dev/ttyUSB0 --serial-baud 115200
```

Contoh keluaran di sisi Arduino/ESP32:

```cpp
void loop() {
  sensors_event_t e;
  // ... baca sensor ...
  Serial.printf(
    "{\"co\":%.2f,\"ch4\":%.2f,\"c2h5oh\":%.2f,\"h2\":%.2f,"
    "\"nh3\":%.2f,\"no2\":%.2f,\"pm1\":%.1f,\"pm25\":%.1f,"
    "\"pm4\":%.1f,\"pm10\":%.1f,\"so2_voltage\":%.2f}\n",
    co, ch4, c2h5oh, h2, nh3, no2, pm1, pm25, pm4, pm10, so2_voltage
  );
  delay(5000);
}
```

Gunakan `\n` di akhir setiap baris.

## Program Raspberry Pi lengkap (sudah digabung)

`raspi_monitor_upload.py` adalah program pembacaan sensor Anda dengan upload
Enviro Monitor di dalamnya. Satu file, siap dijalankan di Pi:

```bash
export ENVIRO_URL="https://devel-ai.ub.ac.id/enviro/api/ingest"
export ENVIRO_API_KEY="ingest-api-key-anda"
export ENVIRO_DEVICE_ID="node-01"
python3 raspi_monitor_upload.py
```

Yang ditambahkan ke program asli:

- `build_payload()` memetakan field CSV ke field API, semua nilai **2 desimal**
- `Uploader` mengirim tiap pembacaan, dengan antrean offline `enviro_queue.jsonl`
- Timestamp tanpa zona dianggap **WIB** (`ENVIRO_DEVICE_TZ`, default `Asia/Jakarta`)
- Gagal jaringan → data masuk antrean, dicoba ulang 5–60 detik
- API key salah (`401/403`) → upload dijeda 60 detik, CSV tetap jalan

Field yang diunggah: PM1.0/2.5/4.0/10, 6 gas MiCS-4514, SO2 (RAW + V),
suhu/kelembapan SHT41, suhu/tekanan/ketinggian BMP280.

Field berikut tetap tercatat di CSV lokal tetapi tidak dikirim ke dashboard:
`nc0_5`, `nc1_0`, `nc2_5`, `nc4_0`, `nc10_0`, `typical_particle_size`,
`mics_ox_adc`, `mics_red_adc`, `mics_power`, `mics_ratio_ox`, `mics_ratio_red`.

Modul upload juga tersedia terpisah di `enviro_upload.py` bila ingin dipakai
ulang di skrip lain.

## Format teks firmware

Firmware yang mencetak blok `ENVIRONMENT MONITORING SYSTEM` juga didukung
langsung. Contoh lengkap ada di `examples/sample-device.txt`.

```bash
python3 enviro_node.py --source serial --format text --serial-port /dev/ttyUSB0
python3 enviro_node.py --source file --format text --file examples/sample-device.txt --once --print
```

Nilai yang dipetakan:

| Blok | Field |
|---|---|
| SPS30 | `pm1`, `pm25`, `pm4`, `pm10` |
| MiCS-4514 | `co`, `ch4`, `c2h5oh`, `h2`, `nh3`, `no2` |
| MQ-136 | `so2_raw`, `so2_voltage` |
| SHT41 | `temp_sht`, `humidity` |
| BMP280 | `temp_bmp`, `pressure`, `altitude` |

Semua angka dibulatkan maksimal **2 desimal**. `Timestamp` perangkat dianggap
waktu WIB lalu dikonversi ke UTC; ubah dengan `--device-tz` bila perlu.


## Mode stdin / file

Pipe dari skrip pembaca hardware apa pun:

```bash
python3 examples/read_sensors.py | python3 enviro_node.py --source stdin
```

Atau baca baris terakhir dari file:

```bash
python3 enviro_node.py --source file --file /var/lib/enviro-node/latest.json
```

## Raspberry Pi: SPS30 + ADS1115

`examples/read_sensors.py` membaca SPS30 lewat I2C dan sensor gas/SO2 lewat
ADS1115, lalu mencetak JSON per baris.

```bash
pip install sensirion-i2c-driver sensirion-i2c-sps30 adafruit-blinka adafruit-ads1x15
python3 examples/read_sensors.py | python3 enviro_node.py --source stdin
```

**Kalibrasi wajib.** Konstanta `r0`, `a`, `b`, dan `rl` di bagian atas skrip
masih nilai contoh. Tanpa kalibrasi, angka ppm tidak akurat. Untuk sensor tipe
MQ, rumus umumnya:

```
Rs = (VCC - Vout) / Vout * RL
ppm = a * (Rs / R0) ** b
```

## Opsi penting

| Opsi | Environment | Default |
|---|---|---|
| `--url` | `ENVIRO_URL` | `https://devel-ai.ub.ac.id/enviro/api/ingest` |
| `--api-key` | `ENVIRO_API_KEY` | — |
| `--device-id` | `ENVIRO_DEVICE_ID` | `node-01` |
| `--interval` | `ENVIRO_INTERVAL` | `5` |
| `--source` | `ENVIRO_SOURCE` | `mock` |
| `--queue` | `ENVIRO_QUEUE` | `enviro-queue.jsonl` |

`--once` untuk sekali baca, `--print` untuk menampilkan payload tanpa mengirim.

## Menjalankan sebagai service

```bash
sudo useradd -r -s /usr/sbin/nologin enviro
sudo mkdir -p /opt/enviro-node /var/lib/enviro-node
sudo chown -R enviro:enviro /var/lib/enviro-node
sudo cp enviro_node.py node.env /opt/enviro-node/
sudo cp enviro-node.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now enviro-node
journalctl -u enviro-node -f
```

## Perilaku saat offline

- Data yang gagal terkirim disimpan di `ENVIRO_QUEUE` (JSON lines).
- Percobaan ulang memakai backoff 5 → 10 → 20 → 40 → 60 detik.
- Saat tersambung, antrean dikirim berurutan dalam batch hingga 200 titik.
- Antrean dibatasi 5000 titik; data terlama dibuang bila penuh.
- Respons `401/403` dianggap fatal (API key salah) dan proses berhenti.

## Troubleshooting

| Gejala | Penyebab |
|---|---|
| `401` | `ENVIRO_API_KEY` salah atau belum diisi |
| `tidak bisa terhubung` | URL/ jaringan; data tetap masuk antrean |
| Data tidak muncul di dashboard | `device_id` berbeda dari pilihan di dashboard (`node-01`) |
| Mode serial tidak membaca | Baud rate salah, atau perangkat mengirim lebih dari satu baris JSON |
| Nilai ppm tidak masuk akal | Kalibrasi `r0`, `a`, `b`, `rl` belum disesuaikan |
