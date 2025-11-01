import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'

// Get build time from environment (set during build)
const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString();

export const metadata: Metadata = {
  title: 'Say What Want',
  description: 'Express yourself freely - anonymous comments and AI conversations',
  viewport: 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, viewport-fit=cover, user-scalable=no, interactive-widget=resizes-content',
  themeColor: '#000000',
  openGraph: {
    title: 'Say What Want',
    description: 'Express yourself freely - anonymous comments with AI conversations',
    type: 'website',
  },
  other: {
    'build-time': BUILD_TIME,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Version check script - monitors for new builds */}
        <Script src="/version-check.js" strategy="afterInteractive" />
      </head>
      <body className="overflow-hidden">
        {children}
      </body>
    </html>
  )
}
