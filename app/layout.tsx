import { Inter, Space_Grotesk } from 'next/font/google'
import type { Metadata } from 'next'
import { ThemeProvider } from '@/components/ThemeProvider'
import { AuthProvider } from '@/components/AuthProvider'
import { Toaster } from 'sonner'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
})

export const metadata: Metadata = {
  title: 'Furniture Inventory Management System',
  description: 'Premium Furniture Business Management',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`} suppressHydrationWarning>
      <body className="bg-slate-50 text-slate-900 dark:bg-black dark:text-slate-50 antialiased" suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined') {
                const originalError = window.onerror;
                window.onerror = function (msg, url, line, col, error) {
                  if (msg === 'ResizeObserver loop limit exceeded' || msg === 'ResizeObserver loop completed with undelivered notifications.' || msg === 'Script error.') {
                    return true;
                  }
                  if (originalError) {
                    return originalError(msg, url, line, col, error);
                  }
                  return false;
                };
              }
            `,
          }}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem={true}
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
            <Toaster position="top-center" richColors expand={true} visibleToasts={6} />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
