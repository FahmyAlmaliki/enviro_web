# Logo

Letakkan file logo di folder ini. Format **PNG transparan** atau **SVG**.
Nama file tanpa ekstensi akan otomatis dicoba sebagai `.png` lalu `.svg`.

| Nama file | Logo |
|---|---|
| `ub.png` / `ub.svg` | Universitas Brawijaya |
| `elektro.png` / `elektro.svg` | Teknik Elektro |
| `teknik-lingkungan.png` / `.svg` | Teknik Lingkungan UB |
| `ub-green-campus.png` / `.svg` | UB Green Campus |

## Ukuran yang disarankan

Videotron menampilkan logo dengan tinggi **±63 px** pada layar 1920×1080
(slot 5.8vh). Agar tetap tajam di layar 4K/retina, sediakan sumber **2–4×**
ukuran tampil:

| Logo | Ukuran sumber | Rasio |
|---|---|---|
| Universitas Brawijaya (emblem) | **512 × 512 px** | 1:1 |
| Teknik Elektro | **800 × 400 px** | 2:1 |
| Teknik Lingkungan UB | **800 × 400 px** | 2:1 |
| UB Green Campus | **800 × 400 px** | 2:1 |

Ketentuan:

- Latar **transparan**, bukan putih.
- Beri padding 5–10% di sekeliling logo agar tidak menempel ke tepi.
- Ukuran file < 300 KB per logo.
- SVG lebih disarankan karena tetap tajam di semua resolusi.
- Logo berwarna gelap/kontras karena header TV berlatar putih.

Setelah file ditaruh, rebuild image agar ikut masuk:

```bash
docker compose up -d --build app
# atau di mesin kecil:
./scripts/build-runtime.sh
```

Selama file belum ada, header menampilkan placeholder teks.
