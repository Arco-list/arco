import { createNavigation } from "next-intl/navigation"
import { routing } from "./routing"

/**
 * Locale-aware navigation primitives. `Link` renders hrefs with the active
 * locale prefix (/nl/..., /en/...) instead of the bare path — bare paths
 * 307-redirect through the middleware, which pollutes the internal link
 * graph for crawlers and adds a hop for users. Use this Link for all
 * internal links in public-facing components.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)
