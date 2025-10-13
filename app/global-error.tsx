"use client"

import GeneralError from "@/components/errors/general-error"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <GeneralError error={error} reset={reset} />
}
