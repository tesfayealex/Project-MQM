import NextAuth, { type NextAuthOptions, User } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text", placeholder: "john@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log("Missing credentials")
          return null
        }

        try {
          // Directly make the login request to the Django API
          console.log(`Logging in user: ${credentials.email}`)

          const response = await fetch(`${API_URL}/api/auth/login/`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
            credentials: "include",
          })

          // Log response details for debugging
          console.log(`Login response status: ${response.status}`)
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            console.error("Login failed:", errorData)
            if (response.status === 401) {
              throw new Error("Invalid credentials")
            } else if (response.status === 403) {
              throw new Error("Account inactive")
            } else {
              throw new Error("Invalid login")
            }
          }

          const user = await response.json()
          
          if (!user || !user.id) {
            throw new Error("Invalid user data received")
          }

          console.log(`User logged in successfully: ${user.email} (ID: ${user.id})`)
          return user
        } catch (e: any) {
          console.error("Error during login:", e.message)
          throw new Error(e.message || "Authentication failed")
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // When user signs in, add their info to the token
        token.id = user.id
        token.email = user.email
        token.name = user.name || user.email
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        // Add user info from the token to the session
        session.user = {
          ...session.user,
          id: token.id as string,
          email: token.email as string,
          name: token.name as string,
        }
      }
      return session
    },
  },
  debug: process.env.NODE_ENV === "development",
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST } 