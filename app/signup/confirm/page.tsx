import Link from "next/link"
import { MailCheck } from "lucide-react"

import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { getFirstSearchParamValue, resolveRedirectPath } from "@/lib/auth-redirect"
import { emailSchema } from "@/lib/supabase/auth-validation"

interface SignupConfirmPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const parseEmail = (value?: string | string[]) => {
  const candidate = getFirstSearchParamValue(value)
  if (!candidate) return undefined

  const result = emailSchema.safeParse(candidate)
  if (!result.success) return undefined

  return result.data
}

export default async function SignupConfirmPage({ searchParams }: SignupConfirmPageProps) {
  const params = (await searchParams) ?? {}
  const email = parseEmail(params.email)
  const redirectTo = resolveRedirectPath(getFirstSearchParamValue(params.redirectTo))
  const redirectLabel = redirectTo === "/dashboard" ? "your dashboard" : redirectTo

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <section className="flex min-h-[calc(100vh-200px)] items-center justify-center bg-muted/30 px-4 py-16">
          <div className="mx-auto w-full max-w-lg rounded-2xl bg-background p-8 shadow-lg">
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <MailCheck className="h-8 w-8 text-primary" aria-hidden="true" />
              </div>
              <h1 className="text-2xl font-semibold">Confirm your email</h1>
              <p className="text-muted-foreground text-sm">
                We just sent a confirmation link{email ? (
                  <>
                    {" "}
                    to <span className="font-medium text-foreground">{email}</span>
                  </>
                ) : null}. Please open the email and click the link to finish setting up your account.
              </p>
            </div>

            <div className="mt-8 space-y-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Next steps</p>
              <ul className="list-disc space-y-2 pl-5">
                <li>Open the confirmation email and follow the secure link.</li>
                <li>You&apos;ll see a confirmation screen, then click &quot;Go to dashboard&quot; to continue.</li>
                <li>
                  Didn&apos;t get it? Give it a minute, check spam, or{' '}
                  <Link href="/help-center" className="text-primary font-medium">
                    visit the help center
                  </Link>
                  .
                </li>
              </ul>
            </div>

            <div className="mt-8 space-y-3 text-center text-sm text-muted-foreground">
              <p>Already confirmed?</p>
              <div className="flex justify-center gap-3">
                <Link href="/login" className="text-primary font-medium">
                  Go to login
                </Link>
                <span aria-hidden="true" className="text-border">
                  |
                </span>
                <Link href="/" className="text-primary font-medium">
                  Back to home
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
