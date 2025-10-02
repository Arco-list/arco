# Supabase SSR Migration Notes

Summary of the auth helper migration completed to replace `@supabase/auth-helpers-nextjs` with `@supabase/ssr`.

## Completed Changes
- Replaced the auth helper dependency (`@supabase/ssr@0.7.0` via `pnpm install`).
- Rebuilt `lib/supabase/server.ts` around `createServerClient`, keeping helper exports for Server Components, Server Actions, and Route Handlers.
- Added `lib/supabase/middleware.ts` with `updateSession()` to manage cookies within Next.js middleware.
- Swapped `lib/supabase/browser.ts` to create a singleton `createBrowserClient` instance and guard against missing env vars.
- Updated `middleware.ts` to delegate to `updateSession` while preserving the `/homeowner` bypass.
- Pointed the auth callback route at the new helpers (`createRouteHandlerSupabaseClient`).
- Earlier session hardening remains in place: session data is only trusted when `getUser()` succeeds (server and client).

## Follow-Up / Manual QA
- [ ] `pnpm dev` smoke test
  - Sign in/out flow
  - Passwordless/email OTP (if enabled)
  - Access to `/dashboard/*` routes (middleware enforced)
  - `/homeowner` path bypass verification
  - Server actions: create/update flows in `app/(auth)/actions.ts`
- [ ] Inspect browser devtools cookies (confirm automatic refresh + domain/path)
- [ ] Confirm RLS-backed queries still succeed with `auth.uid()` (e.g., fetch protected project data)
- [ ] After deploy, monitor Supabase auth logs for unexpected token validation failures
- [ ] Update README/ops docs if additional guidance is needed for future contributors

## Notes
- Env vars required at runtime: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (for service-role client only).
- Middleware `updateSession()` currently only validates the user; add route protection there if we want server-side gating.
- If additional environments exist (preview/staging), ensure their environment variables include the same keys before deploying the changes.
