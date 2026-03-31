import type {Metadata} from 'next';
import { DM_Sans, DM_Mono, Instrument_Serif } from 'next/font/google';
import './globals.css';

// DM Sans — geometric, warm, distinctly NOT Inter. Readable at all sizes.
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-sans', weight: ['400', '500', '600', '700'] });
// DM Mono — matches DM Sans family. Clean data display.
const dmMono = DM_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['400', '500'] });
// Instrument Serif — editorial accent for hero numbers and key metrics
const instrumentSerif = Instrument_Serif({ subsets: ['latin'], variable: '--font-display', weight: ['400'] });

export const metadata: Metadata = {
  title: 'Pivot | Business Intelligence',
  description: 'AI-powered business intelligence, CRM, and execution platform.',
  icons: {
    icon: '/favicon.svg',
    apple: '/icon-192.svg',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${dmMono.variable} ${instrumentSerif.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var t = localStorage.getItem('pivot_theme');
            if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
              document.documentElement.setAttribute('data-theme', 'dark');
            }
          })();
        `}} />
        {children}
      </body>
    </html>
  );
}
