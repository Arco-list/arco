// Public pricing route — the contributor-pays model only works if an
// invited contributor can see the price BEFORE signing up (anchoring:
// "free during the founding period, €39/month later"). Reuses the
// dashboard pricing page, which adapts its header to auth state.
import type { Metadata } from "next"
import PricingPage from "../dashboard/pricing/page"

export const metadata: Metadata = {
  title: "Plans & pricing — Arco",
  description:
    "Publishing projects on Arco is free, forever. Pro gives contributors unlimited project credits, a full company page and Arco Approved verification — €39/month, free during the founding period.",
}

export default PricingPage
