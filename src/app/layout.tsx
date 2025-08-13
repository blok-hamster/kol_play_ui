import type { Metadata, Viewport } from 'next';
import { Darker_Grotesque } from 'next/font/google';
import './globals.css';
import {
  ThemeProvider,
  ThemeScript,
} from '@/components/providers/theme-provider';
import WalletAdapterProvider from '@/components/wallet/wallet-adapter-provider';
import AuthModalWrapper from '@/components/modals/auth-modal-wrapper';
import OnboardingWrapper from '@/components/modals/onboarding-wrapper';
import NotificationProvider from '@/components/providers/notification-provider';
import AuthInitProvider from '@/components/providers/auth-init-provider';

const darkerGrotesque = Darker_Grotesque({ subsets: ['latin'], weight: ['300','400','500','600','700','800','900'] });

export const metadata: Metadata = {
  title: 'KOL Play - Copy Trading Platform',
  description: 'Follow top crypto traders and copy their winning strategies',
  icons: {
    icon: [
      { url: '/favicon-32-white.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32-white.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-48-white.png', sizes: '48x48', type: 'image/png' },
      { url: '/favicon-48-white.png', sizes: '96x96', type: 'image/png' },
      { url: '/favicon-white.ico', sizes: '32x32', type: 'image/x-icon' },
    ],
    shortcut: '/favicon-white.ico',
    apple: [
      { url: '/favicon-192x192.png', sizes: '180x180', type: 'image/png' },
      { url: '/favicon-192x192.png', sizes: '152x152', type: 'image/png' },
      { url: '/favicon-192x192.png', sizes: '144x144', type: 'image/png' },
      { url: '/favicon-192x192.png', sizes: '120x120', type: 'image/png' },
    ],
  },
  manifest: '/site.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#171616' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <link rel="icon" type="image/x-icon" href="/favicon-white.ico" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-32-white.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32-white.png" />
        <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48-white.png" />
        <link rel="icon" type="image/png" sizes="96x96" href="/favicon-48-white.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon-192x192.png" />
        <style>{`html{font-size:17px}button,[role=button]{font-weight:600 !important}`}</style>
      </head>
      <body className={darkerGrotesque.className}>
        <ThemeProvider>
          <WalletAdapterProvider>
            <NotificationProvider>
              <AuthInitProvider>
                {children}
                <AuthModalWrapper />
                <OnboardingWrapper />
              </AuthInitProvider>
            </NotificationProvider>
          </WalletAdapterProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
