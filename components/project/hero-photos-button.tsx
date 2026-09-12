"use client"

import { Images } from "lucide-react"
import { useTranslations } from "next-intl"

/**
 * "View photos" pill on the project-detail hero — same visual language
 * as the editor's "Omslag wijzigen" pill (dark translucent, blurred,
 * rounded-full), bottom-right so it lines up with the Delen button in
 * the sub-nav below.
 *
 * The photo lightbox lives inside PhotoTour further down the page
 * (local state, other side of a server boundary), so the button talks
 * to it with a DOM event rather than threaded props: PhotoTour listens
 * for "arco:open-photo-tour" and opens the lightbox on the first photo.
 */
export function HeroPhotosButton() {
  const t = useTranslations("project_detail")
  return (
    <button
      type="button"
      className="hero-photos-btn"
      onClick={() => window.dispatchEvent(new CustomEvent("arco:open-photo-tour"))}
    >
      <Images size={14} />
      {t("view_photos")}
    </button>
  )
}
