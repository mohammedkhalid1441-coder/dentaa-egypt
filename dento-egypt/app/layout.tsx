// app/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dento Egypt — Clinic Manager',
  description: 'Dental clinic management system',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  )
}
