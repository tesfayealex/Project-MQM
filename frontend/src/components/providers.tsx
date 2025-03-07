"use client"

import { SessionProvider } from "next-auth/react"
import { useState, useEffect } from "react"
import { I18nextProvider } from 'react-i18next'
import { LanguageProvider } from "@/contexts/language-context"
import { AppProps } from "next/app"
import i18n from '@/lib/i18n' // We'll create this file next

// Extract the base component for type compatibility
function ProvidersBase({ children }: { children: React.ReactNode }) {
  // Force hydration to ensure we're on client-side
  const [isClient, setIsClient] = useState(false)
  
  useEffect(() => {
    setIsClient(true)
  }, [])

  return (
    <SessionProvider 
      // Session refresh intervals
      refetchInterval={1 * 60} // Refetch session every minute
      refetchOnWindowFocus={true} // Refresh when window gets focus
      refetchWhenOffline={false} // Don't refresh when offline
    >
      <I18nextProvider i18n={i18n}>
        <LanguageProvider>
          {/* Only render children when we're on client-side to avoid hydration issues */}
          {isClient ? children : <div className="min-h-screen flex items-center justify-center">
            <div className="animate-pulse">Loading...</div>
          </div>}
        </LanguageProvider>
      </I18nextProvider>
    </SessionProvider>
  )
}

// Create a wrapper component that handles the AppProps
function ProvidersComponent({ Component, pageProps }: AppProps) {
  return (
    <ProvidersBase>
      <Component {...pageProps} />
    </ProvidersBase>
  )
}

// Export a consumer-friendly version that accepts children
export function Providers({ children }: { children: React.ReactNode }) {
  return <ProvidersBase>{children}</ProvidersBase>
} 