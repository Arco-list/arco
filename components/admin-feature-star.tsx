"use client"

import { useState } from "react"
import { Star } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/contexts/auth-context"
import { isAdminUser } from "@/lib/auth-utils"
// Card-specific actions: same write as the admin-table toggles but without
// revalidatePath, so toggling a star doesn't refresh the route and reset
// the grid's "Load more" pagination mid-curation.
import { setProjectFeaturedFromCard, setCompanyFeaturedFromCard } from "@/app/admin/feature-star-actions"

/**
 * Admin-only star overlay for discover cards: toggles the featured tier
 * (is_featured) for a project or company straight from the grid. Renders
 * nothing for non-admin visitors; the server actions re-check admin auth,
 * so this is a convenience surface, not the security boundary.
 */
export function AdminFeatureStar({
  entity,
  entityId,
  initialFeatured,
}: {
  entity: "project" | "company"
  entityId: string
  initialFeatured: boolean
}) {
  const { profile } = useAuth()
  const [featured, setFeatured] = useState(initialFeatured)
  const [busy, setBusy] = useState(false)

  const p = profile as { user_types?: string[] | null; admin_role?: string | null } | null
  if (!isAdminUser(p?.user_types, p?.admin_role)) return null

  return (
    <button
      className="discover-card-action-btn"
      onClick={async (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (busy) return
        setBusy(true)
        const next = !featured
        setFeatured(next) // optimistic — reverted on failure
        const result =
          entity === "project"
            ? await setProjectFeaturedFromCard({ projectId: entityId, isFeatured: next })
            : await setCompanyFeaturedFromCard({ companyId: entityId, isFeatured: next })
        if (result.success) {
          toast.success(next ? "Starred as featured" : "Star removed")
        } else {
          setFeatured(!next)
          toast.error(result.error ?? "Failed to update")
        }
        setBusy(false)
      }}
      aria-pressed={featured}
      aria-label={featured ? "Remove star (featured tier)" : "Star as featured"}
      title={featured ? "Remove star (featured tier)" : "Star as featured"}
      disabled={busy}
    >
      <Star size={14} fill={featured ? "#fbbf24" : "none"} stroke={featured ? "#fbbf24" : "currentColor"} strokeWidth={2} />
    </button>
  )
}
