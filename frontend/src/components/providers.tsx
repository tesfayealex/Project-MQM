"use client"

import { SessionProvider } from "next-auth/react"
import { useState, useEffect } from "react"

export function Providers({ children }: { children: React.ReactNode }) {
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
      {/* Only render children when we're on client-side to avoid hydration issues */}
      {isClient ? children : <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>}
    </SessionProvider>
  )
} 