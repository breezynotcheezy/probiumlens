import "./globals.css"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import SessionProviderWrapper from "@/components/SessionProviderWrapper"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Probium Lens",
  description: "Advanced file intelligence and security analysis",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProviderWrapper>
          {children}
        </SessionProviderWrapper>
      </body>
    </html>
  )
}
