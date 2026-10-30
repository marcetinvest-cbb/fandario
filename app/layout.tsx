import './globals.css';
import type { Metadata, Viewport } from 'next';
import { PwaSetup } from '@/components/Install';
import { LaunchIntro } from '@/components/LaunchIntro';

export const metadata: Metadata = {
  title: 'FanDario',
  description: "Dario's Austin weekend sportsbook. Keep Austin Betting.",
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'FanDario', statusBarStyle: 'black-translucent' },
};
export const viewport: Viewport = { themeColor: '#080b18', width: 'device-width', initialScale: 1, maximumScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Rye&display=swap" rel="stylesheet" />
      </head>
      <body>
        <PwaSetup />
        <LaunchIntro />
        {children}
      </body>
    </html>
  );
}
