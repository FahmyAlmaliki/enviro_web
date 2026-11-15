import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Enviro Monitor — AI Center UB',
  description:
    'Dashboard pemantauan kualitas udara: gas CO, CH4, C2H5OH, H2, NH3, NO2, partikulat SPS30, dan SO2.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="font-sans">{children}</body>
    </html>
  )
}
