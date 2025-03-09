import NextAuth from "next-auth"

declare module "next-auth" {
  interface User {
    id: string
    email: string
    firstName?: string
    lastName?: string
    role: string
    name?: string
    groups: Array<{
      id: number
      name: string
    }>
    accessToken?: string
  }

  interface Session {
    user: User
    accessToken?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    email?: string
    firstName?: string
    lastName?: string
    role?: string
    groups?: Array<{
      id: number
      name: string
    }>
    accessToken?: string
  }
} 