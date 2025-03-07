"use client"

import { Providers } from "@/components/providers"
import { cn } from "@/lib/utils"
import "@/styles/globals.css"
import { Inter } from "next/font/google"
import { Toaster } from "@/components/ui/toaster"
import { useEffect, useState } from "react"
import { getCookie } from "cookies-next"

const inter = Inter({ subsets: ["latin"] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Get the current language from cookie
  const [lang, setLang] = useState<string>("en")
  
  useEffect(() => {
    const currentLang = getCookie("NEXT_LOCALE") as string || "en"
    setLang(currentLang)
    
    // Listen for cookie changes to update lang
    const checkCookie = () => {
      const newLang = getCookie("NEXT_LOCALE") as string || "en"
      if (newLang !== lang) {
        setLang(newLang)
      }
    }
    
    // Check periodically for cookie changes
    const interval = setInterval(checkCookie, 1000)
    return () => clearInterval(interval)
  }, [lang])

  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        <title>myQuickMessage</title>
        <meta name="description" content="Survey and feedback management platform" />
      </head>
      <body className={cn("min-h-screen bg-background antialiased", inter.className)} suppressHydrationWarning>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}

