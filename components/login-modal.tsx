"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Eye, Shield, Zap } from "lucide-react"

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  onLogin: (user: any) => void
}

export function LoginModal({ isOpen, onClose, onLogin }: LoginModalProps) {
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true)
    // Simulate Google login with a more realistic delay
    setTimeout(() => {
      const mockUser = {
        id: "user_" + Math.random().toString(36).substr(2, 9),
        name: "Alex Johnson",
        email: "alex.johnson@example.com",
        avatar: "/placeholder.svg?height=40&width=40",
        joinDate: "January 2024",
        scansCompleted: 47,
      }
      onLogin(mockUser)
      setIsLoggingIn(false)
      onClose()
    }, 1500)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
            <Eye className="h-8 w-8 text-white" />
          </div>
          <DialogTitle className="text-2xl font-bold">Welcome to Probium Lens</DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            Sign in to access your scan history, save reports, and unlock advanced features
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Benefits */}
          <div className="grid gap-3">
            <div className="flex items-center gap-3 text-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
                <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <span>Access your complete scan history</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
                <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span>Priority scanning and faster results</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/20">
                <Eye className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <span>Advanced threat intelligence reports</span>
            </div>
          </div>

          <Separator />

          {/* Google Sign In Button */}
          <Button
            variant="outline"
            size="lg"
            className="w-full h-12 text-base font-medium bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 border-2"
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
          >
            {isLoggingIn ? (
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                <span>Signing you in...</span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 0 24 24" width="20">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                <span>Continue with Google</span>
              </div>
            )}
          </Button>

          {/* Privacy Notice */}
          <div className="text-center text-xs text-muted-foreground">
            By signing in, you agree to our{" "}
            <button className="underline underline-offset-4 hover:text-primary">Terms of Service</button> and{" "}
            <button className="underline underline-offset-4 hover:text-primary">Privacy Policy</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
