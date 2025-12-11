import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { AuthProvider } from "@/hooks/use-auth"
import { ErrorBoundary } from "@/components/error-boundary"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"
import { Suspense } from "react"
// Import Firestore error handler to suppress internal errors
import "@/lib/firestore-error-handler"

export const metadata: Metadata = {
  title: "La Concepcion College - Teacher Evaluation System",
  description:
    "Modern teacher evaluation and management platform for La Concepcion College - Changing Lives for the Better",
  
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`font-sans antialiased ${GeistSans.variable} ${GeistMono.variable}`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined') {
                // Suppress React DevTools message
                const originalWarn = console.warn;
                console.warn = function(...args) {
                  if (args[0] && typeof args[0] === 'string' && args[0].includes('Download the React DevTools')) {
                    return;
                  }
                  originalWarn.apply(console, args);
                };
              }
            `,
          }}
        />
        <ErrorBoundary>
          <Suspense
            fallback={
              <div className="min-h-screen flex items-center justify-center institutional-gradient">
                <div className="flex flex-col items-center gap-6 p-8 rounded-2xl glass-effect">
                  <div className="w-16 h-16 relative">
                    <img
                      src="/images/logo.png"
                      alt="La Concepcion College Logo"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <div className="text-center">
                    <p className="text-white font-semibold text-lg">La Concepcion College</p>
                    <p className="text-white/80 text-sm">Teacher Evaluation System</p>
                    <p className="text-white/60 text-xs mt-1">Loading...</p>
                  </div>
                </div>
              </div>
            }
          >
            <AuthProvider>{children}</AuthProvider>
          </Suspense>
        </ErrorBoundary>
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}
