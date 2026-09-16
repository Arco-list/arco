import { redirect } from "next/navigation"

/**
 * /login is a doorway, not a page: signing in happens in the modal,
 * which the login-modal provider auto-opens on the home page whenever a
 * redirectTo param is present.
 *
 * The param has to survive the hop. Dropping it (as this did) meant
 * every "sign in to continue" link from the dashboard landed on a bare
 * home page with no modal and no way back to where the visitor was
 * headed.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>
}) {
  const { redirectTo } = await searchParams
  redirect(redirectTo ? `/?redirectTo=${encodeURIComponent(redirectTo)}` : "/")
}
