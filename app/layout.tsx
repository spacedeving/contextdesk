import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'ContextDesk — Grounded knowledge and support',
  description: 'A secure, multi-tenant knowledge and support workspace for small teams.',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://contextdesk.example.com',
  ),
  openGraph: {
    title: 'ContextDesk',
    description: 'Grounded knowledge. Better support.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ContextDesk',
    description: 'Grounded knowledge. Better support.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
