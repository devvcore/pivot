import type {Metadata} from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Pivot | Enterprise Intelligence',
  description: 'Enterprise business intelligence and transformation platform.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-[#FDFDFD] text-zinc-900 font-sans antialiased selection:bg-zinc-200" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
