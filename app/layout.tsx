import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Say What Want',
  description: 'Express yourself freely - anonymous comments with visual vibes',
  viewport: 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, viewport-fit=cover, user-scalable=no, interactive-widget=resizes-content',
  themeColor: '#000000',
  openGraph: {
    title: 'Say What Want',
    description: 'Express yourself freely - anonymous comments with visual vibes',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="overflow-hidden">
        {children}
      </body>
    </html>
  )
}
