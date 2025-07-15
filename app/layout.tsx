import "./globals.css";
import { Inter } from "next/font/google";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";

export const metadata = {
  title: "Probium Lens - Advanced File Intelligence",
  description: "See through any file with comprehensive security analysis and threat intelligence",
  manifest: "/manifest.json",
};

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProviderWrapper>
          {children}
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
