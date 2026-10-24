import type { Metadata, Viewport } from 'next';
import { Instrument_Sans } from 'next/font/google';
import './globals.css';
import { APP_NAME } from '@/lib/config';
import { SwRegister } from '@/components/SwRegister';

const font = Instrument_Sans({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600', '700'], variable: '--font-instrument', display: 'swap' });

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'Team tracking for to-dos, daily check-ins, orders, QPV status, legs, chat and meetings.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon-192.png' },
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: 'default' }
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#6a4fd8' };

// Applies the saved light/dark choice before first paint (no flash).
const themeScript = `try{var t=localStorage.getItem('emperor-theme');if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" className={font.variable} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}<SwRegister /></body>
    </html>
  );
}
