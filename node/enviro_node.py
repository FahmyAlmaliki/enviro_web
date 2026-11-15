#!/usr/bin/env python3
"""Enviro Monitor — klien node sensor.

Membaca data sensor lalu mengirimkannya ke endpoint ingest Enviro Monitor.
Mendukung dua format masukan:
  - json : satu objek JSON per baris (Arduino/ESP32)
  - text : blok teks ENVIRONMENT MONITORING SYSTEM (firmware perangkat)

Contoh:
    # uji cepat tanpa hardware
    python3 enviro_node.py --source mock --once --print

    # perangkat mengirim blok teks lewat serial
    python3 enviro_node.py --source serial --format text --serial-port /dev/ttyUSB0

    # baca blok teks dari file
    python3 enviro_node.py --source file --format text --file sample.txt --once --print
"""

from __future__ import annotations

import argparse
import json
import logging
import math
import os
import random
import re
import signal
import ssl
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Protocol
from urllib import error, request

try:  # Python 3.9+
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    ZoneInfo = None  # type: ignore

LOG = logging.getLogger("enviro-node")

GASES = ("co", "ch4", "c2h5oh", "h2", "nh3", "no2")
PARTICULATES = ("pm1", "pm25", "pm4", "pm10")
EXTRA_KEYS = (
    "so2_voltage",
    "so2_raw",
    "temp_sht",
    "humidity",
    "temp_bmp",
    "pressure",
    "altitude",
)

ALIASES = {
    "pm1p0": "pm1",
    "pm2_5": "pm25",
    "pm2.5": "pm25",
    "pm2p5": "pm25",
    "pm4p0": "pm4",
    "pm10p0": "pm10",
    "carbon_monoxide": "co",
    "methane": "ch4",
    "ethanol": "c2h5oh",
    "hydrogen": "h2",
    "ammonia": "nh3",
    "nitrogen_dioxide": "no2",
    "h2s": "so2_voltage",
    "h2s_voltage": "so2_voltage",
    "h2s_raw": "so2_raw",
    "voltage": "so2_voltage",
}

BASELINE = {
    "co": 2.0,
    "ch4": 4.0,
    "c2h5oh": 3.0,
    "h2": 1.5,
    "nh3": 1.0,
    "no2": 0.2,
    "pm1": 4.0,
    "pm25": 8.0,
    "pm4": 12.0,
    "pm10": 18.0,
}

SPIKE_LIMIT = {
    "co": 60.0,
    "ch4": 6000.0,
    "c2h5oh": 2200.0,
    "h2": 4500.0,
    "nh3": 40.0,
    "no2": 6.0,
}

# Pemetaan blok teks firmware
TEXT_SECTIONS: Dict[str, Dict[str, str]] = {
    "SPS30": {"PM1.0": "pm1", "PM2.5": "pm25", "PM4.0": "pm4", "PM10.0": "pm10"},
    "MICS-4514": {"CO": "co", "CH4": "ch4", "ETHANOL": "c2h5oh", "H2": "h2", "NH3": "nh3", "NO2": "no2"},
    "MQ-136": {"RAW": "so2_raw", "VOLTAGE": "so2_voltage"},
    "SHT41": {"TEMPERATURE": "temp_sht", "HUMIDITY": "humidity"},
    "BMP280": {"TEMPERATURE": "temp_bmp", "PRESSURE": "pressure", "ALTITUDE": "altitude"},
}

NUMBER_RE = re.compile(r"-?\d+(?:[.,]\d+)?")
SECTION_RE = re.compile(r"^\[([^\]]+)\]")


# --------------------------------------------------------------------------- #
# Model data
# --------------------------------------------------------------------------- #
@dataclass
class Reading:
    gases: Dict[str, float] = field(default_factory=dict)
    sps30: Dict[str, float] = field(default_factory=dict)
    extra: Dict[str, float] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def is_empty(self) -> bool:
        return not self.gases and not self.sps30 and not self.extra

    def to_payload(self, device_id: str) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "device_id": device_id,
            "timestamp": self.timestamp.astimezone(timezone.utc)
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z"),
            "gases": {key: round(value, 2) for key, value in self.gases.items()},
            "sps30": {key: round(value, 2) for key, value in self.sps30.items()},
        }
        for key, value in self.extra.items():
            payload[key] = round(value, 2)
        return payload


def _to_float(value: Any) -> Optional[float]:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number) or number < 0:
        return None
    return number


def _first_number(text: str) -> Optional[float]:
    match = NUMBER_RE.search(text)
    if not match:
        return None
    return _to_float(match.group(0).replace(",", "."))


def _device_zone(tz_name: str):
    if ZoneInfo is not None:
        try:
            return ZoneInfo(tz_name)
        except Exception:
            pass
    return timezone(timedelta(hours=7))


def parse_device_timestamp(text: str, tz_name: str = "Asia/Jakarta") -> datetime:
    """Timestamp firmware tidak berzona; anggap waktu lokal perangkat."""
    try:
        naive = datetime.fromisoformat(text.strip().replace("Z", "+00:00"))
    except ValueError:
        return datetime.now(timezone.utc)
    if naive.tzinfo is None:
        naive = naive.replace(tzinfo=_device_zone(tz_name))
    return naive.astimezone(timezone.utc)


def reading_from_mapping(data: Dict[str, Any]) -> Optional[Reading]:
    """Terima format datar maupun bersarang (gases/sps30/values)."""
    if not isinstance(data, dict):
        return None

    flat: Dict[str, Any] = {}
    for group in ("gases", "sps30", "values"):
        nested = data.get(group)
        if isinstance(nested, dict):
            flat.update(nested)

    for key, value in data.items():
        if key in ("gases", "sps30", "values", "device_id", "timestamp"):
            continue
        flat[key] = value

    gases: Dict[str, float] = {}
    particulates: Dict[str, float] = {}
    extra: Dict[str, float] = {}

    for raw_key, raw_value in flat.items():
        key = str(raw_key).strip().lower().replace(" ", "_")
        key = ALIASES.get(key, key)
        number = _to_float(raw_value)
        if number is None:
            continue
        if key in GASES:
            gases[key] = number
        elif key in PARTICULATES:
            particulates[key] = number
        elif key in EXTRA_KEYS:
            extra[key] = number

    reading = Reading(
        gases=gases,
        sps30=particulates,
        extra=extra,
        timestamp=_parse_timestamp(data.get("timestamp")),
    )
    return None if reading.is_empty() else reading


def _parse_timestamp(value: Any) -> datetime:
    if isinstance(value, str):
        text = value.strip().replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(text)
        except ValueError:
            return datetime.now(timezone.utc)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed
    return datetime.now(timezone.utc)


def parse_text_block(lines: List[str], tz_name: str = "Asia/Jakarta") -> Optional[Reading]:
    """Parse blok teks ENVIRONMENT MONITORING SYSTEM."""
    gases: Dict[str, float] = {}
    particulates: Dict[str, float] = {}
    extra: Dict[str, float] = {}
    timestamp = datetime.now(timezone.utc)
    section: Optional[str] = None

    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue

        if line.lower().startswith("timestamp"):
            if ":" in line:
                timestamp = parse_device_timestamp(line.split(":", 1)[1], tz_name)
            continue

        header = SECTION_RE.match(line)
        if header:
            section = header.group(1).strip().upper()
            continue

        if section is None or ":" not in line:
            continue

        key, rest = line.split(":", 1)
        key = key.strip().upper()
        target = TEXT_SECTIONS.get(section, {}).get(key)
        if not target:
            continue
        number = _first_number(rest)
        if number is None:
            continue

        if target in GASES:
            gases[target] = number
        elif target in PARTICULATES:
            particulates[target] = number
        elif target in EXTRA_KEYS:
            extra[target] = number

    reading = Reading(
        gases=gases,
        sps30=particulates,
        extra=extra,
        timestamp=timestamp,
    )
    return None if reading.is_empty() else reading


# --------------------------------------------------------------------------- #
# Sumber data
# --------------------------------------------------------------------------- #
class Source(Protocol):
    def read(self) -> Optional[Reading]:
        ...


class MockSource:
    """Data tiruan dengan random walk dan sesekali lonjakan di atas ambang."""

    def __init__(self) -> None:
        self.state = dict(BASELINE)

    def read(self) -> Optional[Reading]:
        for key, base in BASELINE.items():
            drift = (random.random() - 0.5) * base * 0.25
            value = self.state[key] + drift + (base - self.state[key]) * 0.08
            if key in SPIKE_LIMIT and random.random() < 0.012:
                value = SPIKE_LIMIT[key] * (0.85 + random.random() * 0.5)
            self.state[key] = max(0.0, value)

        state = self.state
        return Reading(
            gases={key: state[key] for key in GASES},
            sps30={key: state[key] for key in PARTICULATES},
            extra={
                "so2_voltage": round(0.6 + random.random() * 0.02, 2),
                "so2_raw": round(4150 + random.random() * 10, 2),
                "temp_sht": round(26.0 + random.random() * 0.5, 2),
                "humidity": round(68.0 + random.random(), 2),
                "temp_bmp": round(24.7 + random.random() * 0.3, 2),
                "pressure": round(957.8 + random.random(), 2),
                "altitude": round(472.2 + random.random(), 2),
            },
        )


class LineJsonSource:
    """Satu objek JSON per baris dari stream (serial, stdin)."""

    def __init__(self, stream: Any) -> None:
        self.stream = stream

    def read(self) -> Optional[Reading]:
        line = self.stream.readline()
        if not line:
            return None
        if isinstance(line, bytes):
            line = line.decode("utf-8", "replace")
        text = line.strip()
        if not text:
            return None
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            LOG.warning("baris bukan JSON, dilewati: %s", text[:120])
            return None
        return reading_from_mapping(data)


class TextBlockSource:
    """Blok teks multi-baris dari stream, dipisahkan garis '===='."""

    def __init__(self, stream: Any, tz_name: str = "Asia/Jakarta") -> None:
        self.stream = stream
        self.tz_name = tz_name
        self.buffer: List[str] = []
        self.started = False

    def read(self) -> Optional[Reading]:
        while True:
            line = self.stream.readline()
            if not line:
                return None
            if isinstance(line, bytes):
                line = line.decode("utf-8", "replace")
            text = line.strip()

            if text.lower().startswith("timestamp"):
                self.buffer = [text]
                self.started = True
                continue

            if not self.started:
                continue

            if text.startswith("==="):
                if self.buffer:
                    block = self.buffer
                    self.buffer = []
                    reading = parse_text_block(block, self.tz_name)
                    if reading is not None:
                        return reading
                continue

            self.buffer.append(text)


class SerialJsonSource(LineJsonSource):
    def __init__(self, port: str, baud: int, timeout: float = 2.0) -> None:
        try:
            import serial  # type: ignore
        except ImportError as exc:  # pragma: no cover
            raise SystemExit("Mode serial butuh pyserial. Pasang: pip install pyserial") from exc
        self.serial = serial.Serial(port, baud, timeout=timeout)
        super().__init__(self.serial)

    def close(self) -> None:
        try:
            self.serial.close()
        except Exception:  # pragma: no cover
            pass


class SerialTextSource(TextBlockSource):
    def __init__(self, port: str, baud: int, tz_name: str, timeout: float = 2.0) -> None:
        try:
            import serial  # type: ignore
        except ImportError as exc:  # pragma: no cover
            raise SystemExit("Mode serial butuh pyserial. Pasang: pip install pyserial") from exc
        self.serial = serial.Serial(port, baud, timeout=timeout)
        super().__init__(self.serial, tz_name)

    def close(self) -> None:
        try:
            self.serial.close()
        except Exception:  # pragma: no cover
            pass


class FileJsonSource:
    """Ambil baris JSON terakhir dari sebuah file."""

    def __init__(self, path: str) -> None:
        self.path = Path(path)

    def read(self) -> Optional[Reading]:
        try:
            lines = self.path.read_text(encoding="utf-8").splitlines()
        except FileNotFoundError:
            return None
        for line in reversed(lines):
            text = line.strip()
            if not text:
                continue
            try:
                return reading_from_mapping(json.loads(text))
            except json.JSONDecodeError:
                continue
        return None


class FileTextSource:
    """Ambil blok teks terakhir dari sebuah file."""

    def __init__(self, path: str, tz_name: str = "Asia/Jakarta") -> None:
        self.path = Path(path)
        self.tz_name = tz_name

    def read(self) -> Optional[Reading]:
        try:
            lines = self.path.read_text(encoding="utf-8", errors="replace").splitlines()
        except FileNotFoundError:
            return None
        start = 0
        for index, line in enumerate(lines):
            if line.strip().lower().startswith("timestamp"):
                start = index
        return parse_text_block(lines[start:], self.tz_name)


# --------------------------------------------------------------------------- #
# Klien HTTP + antrean offline
# --------------------------------------------------------------------------- #
class IngestError(RuntimeError):
    def __init__(self, message: str, fatal: bool = False) -> None:
        super().__init__(message)
        self.fatal = fatal


class IngestClient:
    def __init__(self, url: str, api_key: str, timeout: float = 10.0, verify: bool = True) -> None:
        self.url = url
        self.api_key = api_key
        self.timeout = timeout
        self.context = None if verify else ssl._create_unverified_context()

    def send(self, payloads: List[Dict[str, Any]]) -> None:
        body = json.dumps({"readings": payloads}, separators=(",", ":")).encode("utf-8")
        req = request.Request(
            self.url,
            data=body,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "x-api-key": self.api_key,
                "User-Agent": "enviro-node/1.1",
            },
        )
        try:
            with request.urlopen(req, timeout=self.timeout, context=self.context) as resp:
                if not 200 <= resp.status < 300:
                    raise IngestError(f"HTTP {resp.status}")
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "replace")[:300]
            raise IngestError(f"HTTP {exc.code}: {detail}", fatal=exc.code in (401, 403)) from exc
        except error.URLError as exc:
            raise IngestError(f"tidak bisa terhubung: {exc.reason}") from exc
        except TimeoutError as exc:
            raise IngestError("permintaan timeout") from exc


class PendingQueue:
    """Antrean payload yang belum terkirim, disimpan ke disk agar tahan restart."""

    def __init__(self, path: str, max_items: int = 5000) -> None:
        self.path = Path(path)
        self.max_items = max_items
        self.items: List[Dict[str, Any]] = []
        self._load()

    def _load(self) -> None:
        if not self.path.exists():
            return
        try:
            with self.path.open("r", encoding="utf-8") as handle:
                for line in handle:
                    line = line.strip()
                    if line:
                        self.items.append(json.loads(line))
        except (OSError, json.JSONDecodeError) as exc:
            LOG.warning("gagal membaca antrean %s: %s", self.path, exc)
        if self.items:
            LOG.info("memuat %d data tertunda dari antrean", len(self.items))

    def _save(self) -> None:
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            temp = self.path.with_suffix(".tmp")
            with temp.open("w", encoding="utf-8") as handle:
                for item in self.items:
                    handle.write(json.dumps(item, separators=(",", ":")) + "\n")
            os.replace(temp, self.path)
        except OSError as exc:
            LOG.warning("gagal menyimpan antrean: %s", exc)

    def add(self, payload: Dict[str, Any]) -> None:
        self.items.append(payload)
        if len(self.items) > self.max_items:
            dropped = len(self.items) - self.max_items
            self.items = self.items[dropped:]
            LOG.warning("antrean penuh, %d data terlama dibuang", dropped)
        self._save()

    def flush(self, client: IngestClient, batch_size: int = 200) -> int:
        sent = 0
        while self.items:
            batch = self.items[:batch_size]
            client.send(batch)
            del self.items[: len(batch)]
            sent += len(batch)
            self._save()
        return sent

    def __len__(self) -> int:
        return len(self.items)


# --------------------------------------------------------------------------- #
# Program utama
# --------------------------------------------------------------------------- #
def build_source(args: argparse.Namespace) -> Source:
    tz_name = args.device_tz
    if args.source == "mock":
        return MockSource()
    if args.source == "serial":
        if not args.serial_port:
            raise SystemExit("--serial-port wajib diisi untuk --source serial")
        if args.format == "text":
            return SerialTextSource(args.serial_port, args.serial_baud, tz_name)
        return SerialJsonSource(args.serial_port, args.serial_baud)
    if args.source == "stdin":
        return TextBlockSource(sys.stdin, tz_name) if args.format == "text" else LineJsonSource(sys.stdin)
    if args.source == "file":
        if not args.file:
            raise SystemExit("--file wajib diisi untuk --source file")
        return FileTextSource(args.file, tz_name) if args.format == "text" else FileJsonSource(args.file)
    raise SystemExit(f"sumber tidak dikenal: {args.source}")


def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Kirim data sensor ke Enviro Monitor")
    parser.add_argument(
        "--url",
        default=os.getenv("ENVIRO_URL", "https://devel-ai.ub.ac.id/enviro/api/ingest"),
        help="endpoint ingest",
    )
    parser.add_argument("--api-key", default=os.getenv("ENVIRO_API_KEY", ""))
    parser.add_argument("--device-id", default=os.getenv("ENVIRO_DEVICE_ID", "node-01"))
    parser.add_argument(
        "--interval",
        type=float,
        default=float(os.getenv("ENVIRO_INTERVAL", "5")),
        help="detik antar pembacaan",
    )
    parser.add_argument(
        "--source",
        choices=("mock", "serial", "stdin", "file"),
        default=os.getenv("ENVIRO_SOURCE", "mock"),
    )
    parser.add_argument(
        "--format",
        choices=("json", "text"),
        default=os.getenv("ENVIRO_FORMAT", "json"),
        help="json: satu objek per baris; text: blok ENVIRONMENT MONITORING SYSTEM",
    )
    parser.add_argument("--serial-port", default=os.getenv("ENVIRO_SERIAL_PORT", "/dev/ttyUSB0"))
    parser.add_argument("--serial-baud", type=int, default=int(os.getenv("ENVIRO_SERIAL_BAUD", "115200")))
    parser.add_argument("--file", default=os.getenv("ENVIRO_FILE", ""))
    parser.add_argument(
        "--device-tz",
        default=os.getenv("ENVIRO_DEVICE_TZ", "Asia/Jakarta"),
        help="zona waktu timestamp perangkat",
    )
    parser.add_argument(
        "--queue",
        default=os.getenv("ENVIRO_QUEUE", "enviro-queue.jsonl"),
        help="file antrean saat offline",
    )
    parser.add_argument("--timeout", type=float, default=10.0)
    parser.add_argument("--once", action="store_true", help="baca sekali lalu keluar")
    parser.add_argument("--print", dest="print_only", action="store_true", help="cetak payload, jangan kirim")
    parser.add_argument("--no-verify", action="store_true", help="lewati verifikasi sertifikat TLS")
    parser.add_argument(
        "--log-level",
        default=os.getenv("ENVIRO_LOG_LEVEL", "INFO"),
        choices=("DEBUG", "INFO", "WARNING", "ERROR"),
    )
    return parser.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> int:
    args = parse_args(argv)
    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(asctime)s %(levelname)-7s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    if not args.print_only and not args.api_key:
        LOG.error("ENVIRO_API_KEY belum diisi (atau pakai --print untuk uji lokal)")
        return 2

    client = IngestClient(args.url, args.api_key, timeout=args.timeout, verify=not args.no_verify)
    queue = None if args.print_only else PendingQueue(args.queue)
    source = build_source(args)

    stopping = {"value": False}

    def handle_signal(signum: int, _frame: Any) -> None:
        LOG.info("menerima sinyal %s, berhenti…", signum)
        stopping["value"] = True

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    LOG.info(
        "sumber=%s format=%s device=%s interval=%.1fs",
        args.source,
        args.format,
        args.device_id,
        args.interval,
    )

    backoff = 0.0
    next_attempt = 0.0

    while not stopping["value"]:
        started = time.monotonic()

        try:
            reading = source.read()
        except Exception as exc:
            LOG.error("gagal membaca sensor: %s", exc)
            reading = None

        if reading is not None:
            payload = reading.to_payload(args.device_id)
            if queue is not None:
                queue.add(payload)
            LOG.debug("baca: %s", json.dumps(payload, separators=(",", ":"))[:240])

        if args.print_only:
            if reading is not None:
                print(json.dumps(reading.to_payload(args.device_id), indent=2))
            if args.once:
                break
        else:
            now = time.monotonic()
            if queue is not None and now >= next_attempt:
                try:
                    sent = queue.flush(client)
                    if sent:
                        LOG.info("terkirim %d data (sisa antrean %d)", sent, len(queue))
                    backoff = 0.0
                except IngestError as exc:
                    if exc.fatal:
                        LOG.error("ditolak server: %s", exc)
                        return 1
                    backoff = min(60.0, max(5.0, backoff * 2 or 5.0))
                    next_attempt = time.monotonic() + backoff
                    LOG.warning("%s — coba lagi dalam %.0fs", exc, backoff)
                except Exception as exc:
                    backoff = min(60.0, max(5.0, backoff * 2 or 5.0))
                    next_attempt = time.monotonic() + backoff
                    LOG.error("kesalahan tak terduga: %s", exc)

            if args.once:
                break

        elapsed = time.monotonic() - started
        remaining = args.interval - elapsed
        if args.once:
            break
        while remaining > 0 and not stopping["value"]:
            time.sleep(min(0.2, remaining))
            remaining -= 0.2

    if queue is not None:
        try:
            queue.flush(client)
        except Exception as exc:
            LOG.warning("antrean tersisa %d data: %s", len(queue), exc)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
