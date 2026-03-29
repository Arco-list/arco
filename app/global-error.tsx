"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold">Something went wrong</h1>
            <p className="text-gray-600">{error.message || "An unexpected error occurred"}</p>
            <button
              onClick={reset}
              className="inline-block px-4 py-2 rounded-md bg-black text-white hover:bg-gray-800"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
