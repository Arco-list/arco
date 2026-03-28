import Link from "next/link"
import type { Metadata } from "next"
import { CheckCircle } from "lucide-react"

import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { getFirstSearchParamValue, resolveRedirectPath } from "@/lib/auth-redirect"

export const metadata: Metadata = {
  title: "Email Confirmed",
  description: "Your email has been successfully verified. Welcome to Arco!",
}

interface EmailConfirmedPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function EmailConfirmedPage({ searchParams }: EmailConfirmedPageProps) {
  const params = (await searchParams) ?? {}
  const redirectParam = getFirstSearchParamValue(params.redirectTo)
  let redirectTo = resolveRedirectPath(redirectParam)

  // Prevent redirect loop: if redirectTo is the signup confirm page, go to dashboard instead
  if (redirectTo === '/signup/confirm') {
    redirectTo = '/dashboard'
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <section className="flex min-h-[calc(100vh-200px)] items-center justify-center bg-background px-4 py-16">
          <div className="mx-auto w-full max-w-lg rounded-2xl bg-background border border-border p-8 shadow-lg">
            <div className="text-center space-y-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" aria-hidden="true" />
              </div>

              <div className="space-y-2">
                <h3 className="heading-3">Email confirmed!</h3>
                <p className="body-small text-muted-foreground">
                  Your email has been successfully verified. You can now access all features of your account.
                </p>
              </div>

              <div className="space-y-4">
                <Button asChild className="w-full">
                  <Link href={redirectTo}>
                    Go to dashboard
                  </Link>
                </Button>

                <div className="text-center">
                  <Link
                    href="/"
                    className="body-small text-muted-foreground hover:text-primary transition-colors"
                  >
                    Back to home
                  </Link>
                </div>
              </div>
            </div>

            <div className="mt-8 p-4 bg-surface rounded-lg">
              <h2 className="body-small font-medium text-foreground mb-2">What&apos;s next?</h2>
              <ul className="body-small text-muted-foreground space-y-1">
                <li>• Complete your profile to get started</li>
                <li>• Browse available projects and professionals</li>
                <li>• Save your favorite projects and professionals</li>
                <li>• Start collaborating with the community</li>
              </ul>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
