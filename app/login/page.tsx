import Link from "next/link"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { LoginForm } from "@/components/auth/login-form"
import { getFirstSearchParamValue, sanitizeRedirectPath } from "@/lib/auth-redirect"

interface LoginPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const AUTH_ERROR_MESSAGES: Record<string, { title: string; description: string }> = {
  auth_error: {
    title: "We couldn't log you in",
    description: "Please try signing in again or request a new magic link.",
  },
  unexpected_error: {
    title: "Something went wrong",
    description: "An unexpected error occurred during sign-in. Please try again.",
  },
  no_code: {
    title: "Sign-in link missing",
    description: "The confirmation link is missing or expired. Request a new magic link to continue.",
  },
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {}
  const redirectParam = getFirstSearchParamValue(params.redirectTo)
  const redirectTo = sanitizeRedirectPath(redirectParam)
  const errorKey = getFirstSearchParamValue(params.error)
  const activeError = errorKey ? AUTH_ERROR_MESSAGES[errorKey] ?? AUTH_ERROR_MESSAGES.unexpected_error : undefined

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <section className="flex min-h-[calc(100vh-200px)] items-center justify-center bg-muted/30 px-4 py-16">
          <div className="mx-auto w-full max-w-md rounded-2xl bg-background p-8 shadow-lg">
            <div className="mb-6 text-center space-y-2">
              <h1 className="text-2xl font-semibold">Welcome back</h1>
              <p className="text-muted-foreground text-sm">
                Sign in to access your saved projects, professionals, and dashboards.
              </p>
            </div>
            {activeError && (
              <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
                <p className="font-medium">{activeError.title}</p>
                <p className="mt-1 text-destructive/80">{activeError.description}</p>
              </div>
            )}
            <LoginForm redirectTo={redirectTo} />
            <div className="mt-6 text-sm text-center text-muted-foreground">
              <span>Don&apos;t have an account?</span>{" "}
              <Link href={`/signup${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ""}`} className="text-primary font-medium">
                Create one
              </Link>
            </div>
            <div className="mt-2 text-sm text-center">
              <Link href="/reset-password" className="text-muted-foreground hover:text-primary">
                Forgot your password?
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
