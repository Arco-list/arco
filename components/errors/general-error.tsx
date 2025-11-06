"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { logger } from "@/lib/logger"

interface GeneralErrorProps {
  error?: Error & { digest?: string }
  reset?: () => void
}

export default function GeneralError({ error, reset }: GeneralErrorProps) {
  useEffect(() => {
    if (error) {
      // Log the error using proper error monitoring service
      logger.error("Global error boundary triggered", {
        component: "GeneralError",
        digest: error.digest,
        userAgent: typeof window !== "undefined" ? window.navigator.userAgent : undefined,
        url: typeof window !== "undefined" ? window.location.href : undefined,
      }, error)
    }
  }, [error])

  return (
    <div className="flex items-center justify-center bg-background py-20">
      <div className="text-center space-y-6 max-w-md mx-auto px-4">
        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-destructive">Error</h1>
          <h2 className="text-2xl font-semibold">Something went wrong</h2>
          <p className="text-muted-foreground">
            An unexpected error occurred. Please try again or contact support if the problem persists.
          </p>
        </div>
        
        <div className="space-y-4">
          {reset && (
            <Button onClick={reset} className="w-full">
              Try Again
            </Button>
          )}
          
          <Button variant="quaternary" size="quaternary" asChild className="w-full">
            <Link href="/">
              Go Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
