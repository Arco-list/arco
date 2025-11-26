# Repository Guidelines

## Project Structure & Module Organization
- Next.js app router lives in `app/`; route groups like `app/dashboard` and marketing pages share layout via `app/layout.tsx`.
- Reusable UI sits in `components/` (ShadCN-derived primitives in `components/ui/`); domain hooks, contexts, and helpers reside in `hooks/`, `contexts/`, and `lib/` respectively.
- Static assets (icons, images) go under `public/`; global styles are split between `app/globals.css` and utility layers in `styles/`.
- Backend configuration and SQL migration history are stored in `supabase/`.

## Build, Test, and Development Commands
- `pnpm dev` starts the Next.js dev server with hot reload.
- `pnpm build` compiles the production bundle; run before deploying.
- `pnpm start` serves the production build locally for smoke checks.
- `pnpm lint` runs `next lint`; use it before every push until automated tests land.

## Coding Style & Naming Conventions
- Use TypeScript with the `@/*` path alias (see `tsconfig.json`); prefer explicit prop and return types.
- Follow 2-space indentation, PascalCase component names, camelCase functions/variables, and kebab-case file names (`components/project-details.tsx`).
- Co-locate feature-specific styles in the component via Tailwind utility classes; extend theme tokens instead of hard-coded colors when possible.
- Run Prettier-compatible formatting (VS Code default) to keep JSX attributes on new lines when they exceed width.

## Testing Guidelines
- No automated test runner is configured yet; lean on `pnpm lint` and manual QA in `pnpm dev`.
- When adding tests, mirror the route structure under `__tests__/` and name files `*.spec.tsx`; prefer React Testing Library for components and Playwright for flows.
- Keep fixtures alongside tests in `__fixtures__/` folders to reduce cross-route coupling.

## Commit & Pull Request Guidelines
- Follow the Conventional Commits style used in history (`feat:`, `fix:`, `docs:`); keep subject lines under 72 characters.
- Squash noisy WIP commits before opening a PR; include a short summary of affected routes (`app/dashboard`, `components/team-switcher.tsx`).
- Reference related Linear/Jira issues in the PR description, attach UI screenshots for visual changes, and list manual checks (browser matrix, Supabase migrations applied).

## Supabase & Environment Notes
- Keep `.env.local` out of version control; copy variables from Vercel dashboard and align with `supabase/README.md`.
- Run pending database migrations via `pnpm supabase migration up` (add script if missing) before testing auth-dependent features.
- Update `supabase/migrations/` when schema changes ship; mention the migration ID in your PR checklist.
