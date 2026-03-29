"use client"

import { useEffect } from "react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Something went wrong</h1>
        <p className="text-muted-foreground">{error.message || "An unexpected error occurred"}</p>
        <button
          onClick={reset}
          className="inline-block px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
