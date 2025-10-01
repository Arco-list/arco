import Link from "next/link"
import type { Metadata } from "next"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { SignupForm } from "@/components/auth/signup-form"
import { getFirstSearchParamValue, sanitizeRedirectPath } from "@/lib/auth-redirect"

export const metadata: Metadata = {
  title: "Create Account",
  description: "Join Arco to post projects, save favorites, and collaborate with architecture and design professionals.",
}

interface SignupPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = (await searchParams) ?? {}
  const redirectParam = getFirstSearchParamValue(params.redirectTo)
  const redirectTo = sanitizeRedirectPath(redirectParam)

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <section className="flex min-h-[calc(100vh-200px)] items-center justify-center bg-muted/30 px-4 py-16">
          <div className="mx-auto w-full max-w-md rounded-2xl bg-background p-8 shadow-lg">
            <div className="mb-6 text-center space-y-2">
              <h1 className="text-2xl font-semibold">Create your account</h1>
              <p className="text-muted-foreground text-sm">
                Sign up to save projects, collaborate with professionals, and manage your workspace.
              </p>
            </div>
            <SignupForm redirectTo={redirectTo} />
            <div className="mt-6 text-sm text-center text-muted-foreground">
              <span>Already have an account?</span>{" "}
              <Link href={`/login${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ""}`} className="text-primary font-medium">
                Sign in instead
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
