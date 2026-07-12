import { requirePhotographyAdmin } from "@/lib/photography-gate"
import { fetchDiscoverPhotographers } from "@/lib/photographers/queries"
import { PhotographyClient } from "./photography-client"

export const dynamic = "force-dynamic"

/**
 * Admin-only landing page for photographers.
 *
 * Targets architects who want their built work photographed. Mirrors
 * /businesses/architects visually — Header, HeroSection, then a
 * simple photographer grid instead of the ProjectCarousel. No CTA
 * (photographers aren't the audience), no filter/sort (Phase 1 keeps
 * it lean while we grow the roster). Public rollout comes when we
 * have enough listed photographers to fill the grid; until then the
 * page 404s for non-admins via requirePhotographyAdmin — same
 * pattern as /products.
 */
export default async function PhotographyLandingPage() {
  await requirePhotographyAdmin()
  const photographers = await fetchDiscoverPhotographers()
  return <PhotographyClient photographers={photographers} />
}
