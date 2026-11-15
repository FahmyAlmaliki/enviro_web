#!/usr/bin/env python3
"""Contoh node Raspberry Pi: SPS30 (I2C) + gas/SO2 lewat ADS1115.

Mencetak satu baris JSON setiap interval, siap dipipe ke enviro_node.py:

    python3 read_sensors.py | python3 ../enviro_node.py --source stdin

Pemasangan:
    pip install sensirion-i2c-driver sensirion-i2c-sps30 adafruit-blinka adafruit-ads1x15

PENTING: konstanta kalibrasi di bawah hanya contoh. Nilai ppm tidak akan akurat
sebelum Anda melakukan kalibrasi R0 dan kurva (a, b) untuk masing-masing sensor.
"""

from __future__ import annotations

import argparse
import json
import time
from typing import Any, Dict, Optional

# --------------------------------------------------------------------------- #
# Konfigurasi kalibrasi (SESUAIKAN DENGAN SENSOR ANDA)
# --------------------------------------------------------------------------- #
VCC = 3.3                 # tegangan referensi ADC
ADC_GAIN = 1              # gain ADS1115 (1 = +/-4.096 V)

# Setiap entri: alamat I2C, kanal 0-3, nama field, dan parameter kalibrasi.
# Rs = (VCC - Vout) / Vout * RL
# ppm = a * (Rs / R0) ** b
GAS_CHANNELS = [
    {"address": 0x48, "channel": 0, "key": "co",     "rl": 10_000.0, "r0": 10_000.0, "a": 100.0, "b": -1.5},
    {"address": 0x48, "channel": 1, "key": "ch4",    "rl": 10_000.0, "r0": 10_000.0, "a": 100.0, "b": -1.5},
    {"address": 0x48, "channel": 2, "key": "c2h5oh", "rl": 10_000.0, "r0": 10_000.0, "a": 100.0, "b": -1.5},
    {"address": 0x48, "channel": 3, "key": "h2",     "rl": 10_000.0, "r0": 10_000.0, "a": 100.0, "b": -1.5},
    {"address": 0x49, "channel": 0, "key": "nh3",    "rl": 10_000.0, "r0": 10_000.0, "a": 100.0, "b": -1.5},
    {"address": 0x49, "channel": 1, "key": "no2",    "rl": 10_000.0, "r0": 10_000.0, "a": 100.0, "b": -1.5},
]

I2C_BUS = 1
SPS30_ADDRESS = 0x69


def ppm_from_voltage(voltage: float, rl: float, r0: float, a: float, b: float) -> Optional[float]:
    if voltage <= 0.001 or voltage >= VCC:
        return None
    rs = (VCC - voltage) / voltage * rl
    ratio = rs / r0 if r0 else 0.0
    if ratio <= 0:
        return None
    return max(0.0, a * ratio**b)


def read_adc() -> Dict[str, float]:
    """Baca seluruh kanal ADS1115. Mengembalikan {} bila library tidak ada."""
    try:
        import board  # type: ignore
        import adafruit_ads1x15.ads1115 as ADS  # type: ignore
        from adafruit_ads1x15.analog_in import AnalogIn  # type: ignore
    except ImportError as exc:
        print(f"# ADS1115 tidak aktif: {exc}", file=__import__("sys").stderr)
        return {}

    i2c = board.I2C()
    devices: Dict[int, Any] = {}
    values: Dict[str, float] = {}

    for item in GAS_CHANNELS:
        address = item["address"]
        if address not in devices:
            devices[address] = ADS.ADS1115(i2c, address=address, gain=ADC_GAIN)
        channel = AnalogIn(devices[address], item["channel"])
        ppm = ppm_from_voltage(channel.voltage, item["rl"], item["r0"], item["a"], item["b"])
        if ppm is not None:
            values[item["key"]] = round(ppm, 3)

    return values


class Sps30Reader:
    def __init__(self) -> None:
        self.device = None
        try:
            from sensirion_i2c_driver import I2cConnection, LinuxI2cTransceiver  # type: ignore
            from sensirion_i2c_sps30.device import Sps30Device  # type: ignore
        except ImportError as exc:
            print(f"# SPS30 tidak aktif: {exc}", file=__import__("sys").stderr)
            return

        self.transceiver = LinuxI2cTransceiver(f"/dev/i2c-{I2C_BUS}")
        self.device = Sps30Device(I2cConnection(self.transceiver))
        self.device.start_measurement()
        time.sleep(1.0)

    def read(self) -> Dict[str, float]:
        if self.device is None:
            return {}
        measurement = self.device.read_measurement()

        def pick(*names: str) -> Optional[float]:
            for name in names:
                value = getattr(measurement, name, None)
                if value is not None:
                    return float(value)
            return None

        # Sebagian versi library mengembalikan tuple, sebagian objek.
        if isinstance(measurement, (tuple, list)) and len(measurement) >= 4:
            pm1, pm25, pm4, pm10 = measurement[:4]
        else:
            pm1 = pick("mass_concentration_pm1p0", "mass_concentration_pm1")
            pm25 = pick("mass_concentration_pm2p5", "mass_concentration_pm2_5")
            pm4 = pick("mass_concentration_pm4p0", "mass_concentration_pm4")
            pm10 = pick("mass_concentration_pm10p0", "mass_concentration_pm10")

        result: Dict[str, float] = {}
        for key, value in (("pm1", pm1), ("pm25", pm25), ("pm4", pm4), ("pm10", pm10)):
            if value is not None:
                result[key] = round(float(value), 2)
        return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Baca SPS30 + ADS1115, cetak JSON per baris")
    parser.add_argument("--interval", type=float, default=5.0)
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()

    sps30 = Sps30Reader()

    while True:
        gases = read_adc()
        particulate = sps30.read()

        payload: Dict[str, Any] = {"gases": gases, "sps30": particulate}

        print(json.dumps(payload, separators=(",", ":")), flush=True)

        if args.once:
            break
        time.sleep(args.interval)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
