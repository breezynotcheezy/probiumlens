import type React from "react"
import "./globals.css"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { SessionProvider } from "next-auth/react";

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "Probium Lens - Advanced File Intelligence",
  description: "See through any file with comprehensive security analysis and threat intelligence",
  manifest: "/manifest.json",
    generator: 'v0.dev'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
