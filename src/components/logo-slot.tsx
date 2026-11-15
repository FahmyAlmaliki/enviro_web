'use client'

import { useState } from 'react'
import { BASE_PATH } from '@/lib/client-api'

interface Props {
  file: string
  name: string
  caption?: string
  size?: 'sm' | 'tv'
}

function withBase(path: string): string {
  return BASE_PATH ? `${BASE_PATH}${path}` : path
}

export function LogoSlot({ file, name, caption, size = 'sm' }: Props) {
  // Bisa tanpa ekstensi: coba .png lalu .svg
  const candidates = file.includes('.') ? [file] : [`${file}.png`, `${file}.svg`]
  const [attempt, setAttempt] = useState(0)

  if (attempt < candidates.length) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={withBase(`/logos/${candidates[attempt]}`)}
        alt={name}
        onError={() => setAttempt((value) => value + 1)}
        className="h-full w-auto max-w-full object-contain"
      />
    )
  }

  if (size === 'tv') {
    return (
      <div className="flex h-full flex-col justify-center rounded-[6px] border border-dashed border-line px-[0.6vw] text-center">
        <span className="text-[1.05vw] font-extrabold uppercase leading-tight tracking-wide text-ink">
          {name}
        </span>
        {caption ? (
          <span className="text-[0.78vw] font-medium uppercase tracking-[0.16em] text-muted">
            {caption}
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col justify-center rounded-[6px] border border-dashed border-line px-3 text-center">
      <span className="text-[11px] font-bold uppercase leading-tight text-ink">{name}</span>
      {caption ? <span className="text-[9px] uppercase tracking-widest text-muted">{caption}</span> : null}
    </div>
  )
}
