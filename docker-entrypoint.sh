#!/bin/sh
# Salin build Next.js ke tmpfs (/app/.next) lalu jalankan server.
# Tujuannya agar pembacaan chunk tidak menunggu disk yang lambat.
set -e

if [ -d /app/.next-dist ]; then
  mkdir -p /app/.next
  # Salin isi direktori, jangan hapus mount point tmpfs-nya
  cp -a /app/.next-dist/. /app/.next/
fi

exec node server.js
