import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Surveys | myQuickMessage",
  description: "Manage your surveys, view responses, and create new surveys",
}

export default function SurveysLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
} 