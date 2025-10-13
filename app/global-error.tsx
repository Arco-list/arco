"use client"

import GeneralError from "@/components/errors/general-error"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div className="min-h-screen flex flex-col">
          <Header />
          <main className="flex-1">
            <GeneralError error={error} reset={reset} />
          </main>
          <Footer />
        </div>
      </body>
    </html>
  )
}
