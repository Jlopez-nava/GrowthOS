import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import './brand.css';
const jakarta = localFont({
  src: [
    { path: '../public/fonts/plus-jakarta-sans-400.ttf', weight: '400', style: 'normal' },
    { path: '../public/fonts/plus-jakarta-sans-500.ttf', weight: '500', style: 'normal' },
    { path: '../public/fonts/plus-jakarta-sans-600.ttf', weight: '600', style: 'normal' },
    { path: '../public/fonts/plus-jakarta-sans-700.ttf', weight: '700', style: 'normal' },
    { path: '../public/fonts/plus-jakarta-sans-800.ttf', weight: '800', style: 'normal' },
  ],
  variable: '--font-jakarta',
  display: 'swap',
});
export const metadata: Metadata = { title: 'GrowthOS · Your next best move', description: 'An evidence-first marketing workbench. Connect data, review opportunities, and prepare your next move.' };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) { return <html lang="en" className={jakarta.variable}><body>{children}</body></html>; }
