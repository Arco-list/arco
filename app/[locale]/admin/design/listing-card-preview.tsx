"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"

import { ListingCard } from "@/components/listing-card"
import { PROJECT_STATUS_DOT_CLASS } from "@/lib/project-status-config"
import { CONTRIBUTOR_STATUS_DOT_CLASS } from "@/lib/contributor-status-config"

/**
 * Every state the listing card can be in, side by side.
 *
 * The card is the same component Listings and the company edit page
 * render, so what is drawn here is the real thing — only the callbacks
 * are inert. That is the point: the states are hard to assemble from
 * real data (you need a free plan, two credits and an unaccepted
 * invitation at once), and the two pages had quietly drifted apart
 * because nobody could see them together.
 *
 * Labels and dot colours come from the same config and translations the
 * pages use, never typed out here. Typed out, they drifted within a
 * day: a draft read "Concept" with a grey dot while the product says
 * "In bewerking" in amber — a gallery lying about the thing it exists
 * to show.
 */

// A flat colour stands in for the photo: the card's own layout is what
// is under review, and a real image only argues about itself.
const COVER = "data:image/svg+xml;utf8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#8d8d8a"/></svg>',
)

const buildStates = (t: (key: string) => string) => [
  {
    note: "Owner — the badge bottom-left, Edit project on hover, the full menu.",
    props: {
      title: "Villa in het buitengebied van Heesch",
      coverImageUrl: COVER,
      statusLabel: t("published"),
      statusDotClass: PROJECT_STATUS_DOT_CLASS.published,
      role: "owner" as const,
    },
  },
  {
    note: "Contributor, on the company page. Change cover on hover.",
    props: {
      title: "Herenhuis aan de Vecht",
      coverImageUrl: COVER,
      statusLabel: t("live_on_page"),
      statusDotClass: CONTRIBUTOR_STATUS_DOT_CLASS.live_on_page,
      role: "contributor" as const,
    },
  },
  {
    note: "Contributor, off the company page by their own choice — no lock: the status is theirs to change.",
    props: {
      title: "Loft in de Jordaan",
      coverImageUrl: COVER,
      statusLabel: t("listed"),
      statusDotClass: CONTRIBUTOR_STATUS_DOT_CLASS.listed,
      role: "contributor" as const,
    },
  },
  {
    note: "Contributor, off the page because the free place is taken. Locked, and the badge is the way to Pro.",
    props: {
      title: "Boerderijrenovatie Veghel",
      coverImageUrl: COVER,
      statusLabel: t("listed"),
      statusDotClass: CONTRIBUTOR_STATUS_DOT_CLASS.listed,
      role: "contributor" as const,
      locked: true,
    },
  },
  {
    note: "Invited, not yet accepted — Accept sits on the image and outranks everything else.",
    props: {
      title: "Penthouse Zuidas",
      coverImageUrl: COVER,
      statusLabel: t("invited"),
      statusDotClass: CONTRIBUTOR_STATUS_DOT_CLASS.invited,
      role: "contributor" as const,
      invited: true,
    },
  },
  {
    note: "No cover photo yet.",
    props: {
      title: "Nieuwbouw Bosrijk",
      coverImageUrl: null,
      statusLabel: t("draft"),
      statusDotClass: PROJECT_STATUS_DOT_CLASS.draft,
      role: "owner" as const,
    },
  },
]

const noop = () => {}

export function ListingCardPreview() {
  const t = useTranslations("project_status.labels")
  const [open, setOpen] = useState<number | null>(null)
  const STATES = buildStates((k) => t(k))

  return (
    <div className="discover-grid">
      {STATES.map((state, i) => (
        <div key={i}>
          <ListingCard
            {...state.props}
            meta={<p className="discover-card-sub">Villa · Heesch</p>}
            menuOpen={open === i}
            onMenuOpenChange={(next) => setOpen(next ? i : null)}
            onOpen={noop}
            onStatusClick={noop}
            onAccept={noop}
            onUpgrade={noop}
            onEditListing={state.props.role === "owner" ? noop : undefined}
            onUpdateStatus={noop}
            onChangeCover={noop}
            viewUrl="#"
            onDelete={noop}
          />
          <p className="arco-small-text" style={{ marginTop: 10, color: "var(--arco-grey)" }}>
            {state.note}
          </p>
        </div>
      ))}
    </div>
  )
}
