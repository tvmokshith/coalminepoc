import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Astrikos - Coal Mining Intelligence Platform',
  description: 'Enterprise-grade coal mining command center with AI advisory and digital twin',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#050a18" />
        <meta name="color-scheme" content="dark" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
