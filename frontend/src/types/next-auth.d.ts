import NextAuth from "next-auth"

declare module "next-auth" {
  interface User {
    id: string
    email: string
    firstName?: string
    lastName?: string
    role: string
  }

  interface Session {
    user: User & {
      role: string
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    email?: string
    firstName?: string
    lastName?: string
    role?: string
  }
} 