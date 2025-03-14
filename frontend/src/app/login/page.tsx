"use client"

import { useState, useEffect } from "react"
import { signIn, signOut } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { useTranslation } from "react-i18next"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { t } = useTranslation('login')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Handle URL error params
  useEffect(() => {
    if (searchParams?.get("error") === "CredentialsSignin") {
      setError(t('errors.invalidCredentials'))
    }
    if (searchParams?.get("error") === "session_expired") {
      setError(t('errors.sessionExpired'))
    }
  }, [searchParams, t])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const formData = new FormData(event.currentTarget)
      const email = formData.get("email") as string
      const password = formData.get("password") as string
      
      console.log(`Attempting login for email: ${email}`)
      
      // First, make a direct login to Django to ensure we get the cookies
      try {
        const djangoResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login/`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
          credentials: 'include',
        })
        
        // Check response and log cookies
        console.log("Django login status:", djangoResponse.status)
        console.log("Django login cookies:", document.cookie)
        
        if (!djangoResponse.ok) {
          const errorData = await djangoResponse.json().catch(() => ({ detail: "Unknown error" }))
          
          // If already authenticated, sign out first and retry
          if (errorData.detail === "Already authenticated") {
            console.log("User is already authenticated, signing out first...")
            
            // First logout from Django
            await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/auth/logout/`, {
              method: 'POST',
              credentials: 'include',
            })
            
            // Then logout from NextAuth
            await signOut({ redirect: false })
            
            // Wait a moment for sessions to clear
            await new Promise(resolve => setTimeout(resolve, 500))
            
            // Retry the login after signing out
            const retryResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/auth/login/`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ email, password }),
              credentials: 'include',
            })
            
            if (!retryResponse.ok) {
              const retryErrorData = await retryResponse.json().catch(() => ({ detail: "Unknown error" }))
              throw new Error(retryErrorData.detail || t('errors.invalidCredentials'))
            }
          } else {
            throw new Error(errorData.detail || t('errors.invalidCredentials'))
          }
        }
      } catch (err) {
        console.warn("Direct Django login failed:", err)
        throw err
      }
      
      // Then use NextAuth for session management
      const response = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      console.log("NextAuth login response:", response)

      if (response?.error) {
        console.error("Login error:", response.error)
        setError(t('errors.invalidCredentials'))
      } else if (response?.ok) {
        console.log("Login successful, redirecting to dashboard")
        
        // Wait a short time for cookies to be properly set
        await new Promise(resolve => setTimeout(resolve, 300))
        
        // Show cookies for debugging
        console.log("Cookies after login:", document.cookie)
        
        router.push("/dashboard")
        router.refresh()
      }
    } catch (err: any) {
      console.error("Login error:", err)
      setError(err.message || t('errors.unknown'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-8 rounded-lg border bg-card p-6 shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label
              className="text-sm font-medium leading-none"
              htmlFor="email"
            >
              {t('email')}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              disabled={isLoading}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label
              className="text-sm font-medium leading-none"
              htmlFor="password"
            >
              {t('password')}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              disabled={isLoading}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          {error && (
            <div className="text-sm text-red-500">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? t('signingIn') : t('signin')}
          </button>
        </form>
      </div>
    </div>
  )
} 