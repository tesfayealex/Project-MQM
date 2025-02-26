import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Login - myQuickMessage",
  description: "Login to your myQuickMessage account",
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
} 