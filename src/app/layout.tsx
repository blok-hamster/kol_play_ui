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
      { url: '/6.png', type: 'image/png' },
    ],
    shortcut: '/6.png',
    apple: [
      { url: '/6.png', type: 'image/png' },
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
        <link rel="icon" type="image/png" sizes="32x32" href="/6.png" />
        <link rel="icon" type="image/png" sizes="48x48" href="/6.png" />
        <link rel="icon" type="image/png" sizes="96x96" href="/6.png" />
        <link rel="icon" type="image/png" sizes="128x128" href="/6.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/6.png" />
        <link rel="icon" type="image/png" sizes="256x256" href="/6.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/6.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/6.png" />
        <link rel="shortcut icon" href="/6.png" />
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
