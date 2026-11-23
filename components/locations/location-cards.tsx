"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useLocale } from "next-intl"
import { Link } from "@/i18n/navigation"
import { Store, X } from "lucide-react"
import { toast } from "sonner"

import { downscaleForUpload } from "@/lib/image-downscale"
import { locationKindLabel, type LocationRecord } from "@/lib/locations/types"
import { groupWeek, openStatus, parseOpeningHours } from "@/lib/locations/opening-hours"

/**
 * Showrooms als kaarten in het formaat van een professionalkaart: foto
 * (4:3), naam, soort · plaats. Publiek opent een klik een pop-up met
 * adres, telefoon, openingstijden, website en een routeknop; zonder foto
 * staat daar een grijs vlak met het logo van het bedrijf. In de editor
 * opent een klik het bewerkformulier en zit het uploaden van de foto in
 * de kaart zelf: een pil midden op de foto, zoals "Project bewerken" op
 * een projectkaart, en zonder foto een leeg grijs vlak met die pil.
 */

/** De foto gaat via een server action, en die neemt standaard maar 1 MB
 *  aan; een telefoonfoto is groter en strandde daar zonder melding. Een
 *  showroomfoto wordt nooit groter getoond dan ~1200px, dus 2000px lange
 *  zijde onder de 900 KB is ruim genoeg. */
const UPLOAD_LIMIT = { targetBytes: 900 * 1024, maxEdge: 2000 }

const COPY = {
  nl: {
    addPhoto: "Foto toevoegen",
    changePhoto: "Foto wijzigen",
    uploading: "Uploaden…",
    uploadFailed: "Foto uploaden mislukt",
    address: "Adres",
    phone: "Telefoon",
    hours: "Openingstijden",
    website: "Website",
    route: "Route plannen",
    call: "Bellen",
    close: "Sluiten",
    owner: "Van",
  },
  en: {
    addPhoto: "Add photo",
    changePhoto: "Change photo",
    uploading: "Uploading…",
    uploadFailed: "Could not upload the photo",
    address: "Address",
    phone: "Phone",
    hours: "Opening hours",
    website: "Website",
    route: "Get directions",
    call: "Call",
    close: "Close",
    owner: "By",
  },
}

/** Van wie een showroom is, voor een overzicht over bedrijven en merken
 *  heen (/showrooms): naam en logo op de kaart, link in de pop-up. */
export type LocationOwner = { name: string; logoUrl: string | null; href: string }

type Props = {
  locations: LocationRecord[]
  /** Per vestiging-id de eigenaar; alleen op het overzicht. */
  owners?: Record<string, LocationOwner>
  /** Logo van het bedrijf of merk, voor kaarten zonder foto. */
  fallbackLogoUrl?: string | null
  /** Taal van de labels; standaard de taal van de pagina. */
  locale?: string
} & (
  | { mode: "public" }
  | { mode: "edit"; onEdit: (loc: LocationRecord) => void; onUpload: (loc: LocationRecord, file: File) => Promise<void> }
)

export function LocationCards(props: Props) {
  const pageLocale = useLocale()
  const locale = props.locale ?? pageLocale
  const c = locale === "nl" ? COPY.nl : COPY.en
  const [open, setOpen] = useState<LocationRecord | null>(null)

  return (
    <>
      <div className="discover-grid">
        {props.locations.map((loc) => (
          <LocationCard
            key={loc.id}
            loc={loc}
            locale={locale}
            copy={c}
            owner={props.owners?.[loc.id] ?? null}
            fallbackLogoUrl={props.owners?.[loc.id]?.logoUrl ?? props.fallbackLogoUrl ?? null}
            onClick={() => (props.mode === "edit" ? props.onEdit(loc) : setOpen(loc))}
            onUpload={props.mode === "edit" ? (file) => props.onUpload(loc, file) : undefined}
          />
        ))}
      </div>
      {open && <LocationDetailPopup loc={open} owner={props.owners?.[open.id] ?? null} locale={locale} copy={c} onClose={() => setOpen(null)} />}
    </>
  )
}

function LocationCard({ loc, owner, locale, copy, fallbackLogoUrl, onClick, onUpload }: {
  loc: LocationRecord
  owner: LocationOwner | null
  locale: string
  copy: typeof COPY.nl
  fallbackLogoUrl: string | null
  onClick: () => void
  onUpload?: (file: File) => Promise<void>
}) {
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  // Op het overzicht: de naam van de showroom of anders van de eigenaar,
  // daaronder de eigenaar (als die nog niet de titel is) en de plaats.
  const title = loc.name ?? owner?.name ?? loc.city ?? loc.streetAddress ?? locationKindLabel(loc.kind, locale)
  const sub = owner
    ? [owner.name !== title ? owner.name : locationKindLabel(loc.kind, locale), loc.city].filter(Boolean).join(" · ")
    : [locationKindLabel(loc.kind, locale), loc.city].filter(Boolean).join(" · ")

  const upload = async (picked: File) => {
    if (!onUpload) return
    setUploading(true)
    try {
      const { file } = await downscaleForUpload(picked, UPLOAD_LIMIT)
      await onUpload(file)
    } catch {
      // Een server action die te groot of onbereikbaar is gooit, in
      // plaats van een resultaat terug te geven; zonder dit gebeurde er
      // na "Uploaden…" gewoon niets.
      toast.error(copy.uploadFailed)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      className="discover-card"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick() } }}
      style={{ cursor: "pointer" }}
    >
      <div className="discover-card-image-wrap location-card-image">
        <div className="discover-card-image-layer">
          {loc.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={loc.imageUrl} alt={title} width={600} height={450} loading="lazy" decoding="async" />
          ) : (
            // In de editor leeg: de knop in het midden is de inhoud.
            <div className="location-card-placeholder">
              {onUpload ? null : fallbackLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fallbackLogoUrl} alt="" className="location-card-placeholder-logo" />
              ) : (
                <Store size={40} strokeWidth={1} aria-hidden />
              )}
            </div>
          )}
        </div>
        {onUpload && (
          <>
            <div className="location-card-upload-layer" data-empty={loc.imageUrl ? undefined : "true"} data-busy={uploading ? "true" : undefined}>
              <button
                type="button"
                className="location-card-upload"
                disabled={uploading}
                onClick={(e) => { e.stopPropagation(); input.current?.click() }}
              >
                {uploading ? copy.uploading : loc.imageUrl ? copy.changePhoto : copy.addPhoto}
              </button>
            </div>
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ""
                if (file) void upload(file)
              }}
            />
          </>
        )}
      </div>
      <div className="pro-card-info">
        <div>
          <h3 className="discover-card-title">{title}</h3>
          {sub && <p className="discover-card-sub">{sub}</p>}
        </div>
      </div>
    </div>
  )
}

/**
 * Pop-up van een showroom: foto bovenaan (16:10, nooit hoger dan een derde
 * van het scherm, sluitknop erop), dan naam, soort · plaats en of hij nu
 * open is; daaronder adres, telefoon, website en de openingstijden per
 * groep dagen in het Nederlands. Onderaan vast "Route plannen" en
 * "Bellen", zodat ze ook op een klein scherm in beeld blijven; alleen
 * het midden scrolt.
 */
function LocationDetailPopup({ loc, owner, locale, copy, onClose }: {
  loc: LocationRecord
  owner: LocationOwner | null
  locale: string
  copy: typeof COPY.nl
  onClose: () => void
}) {
  const title = loc.name ?? owner?.name ?? loc.city ?? locationKindLabel(loc.kind, locale)
  const sub = [locationKindLabel(loc.kind, locale), loc.city].filter(Boolean).join(" · ")
  const street = loc.streetAddress ?? loc.address?.split(",")[0]?.trim() ?? null
  const cityLine = [loc.postalCode, loc.city].filter(Boolean).join(" ")
  const addressText = [street, cityLine].filter(Boolean).join(", ")
  const mapsUrl = loc.googlePlaceId
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(title)}&query_place_id=${loc.googlePlaceId}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.address ?? [street, loc.city].filter(Boolean).join(", "))}`
  const website = loc.website?.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "") ?? null
  const hasMaps = Boolean(loc.address || loc.googlePlaceId)

  const week = useMemo(() => parseOpeningHours(loc.openingHours), [loc.openingHours])
  // Status pas in de browser: de server rendert op een andere klok.
  const [status, setStatus] = useState<ReturnType<typeof openStatus> | null>(null)
  useEffect(() => { if (week) setStatus(openStatus(week, locale)) }, [week, locale])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev }
  }, [onClose])

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="showroom-popup" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        {loc.imageUrl ? (
          <div className="showroom-popup-photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={loc.imageUrl} alt={title} />
            <button type="button" className="showroom-popup-close showroom-popup-close--on-photo" onClick={onClose} aria-label={copy.close}>
              <X size={18} strokeWidth={1.75} />
            </button>
          </div>
        ) : null}

        <div className="showroom-popup-body">
          <div className="showroom-popup-head">
            <div style={{ minWidth: 0 }}>
              {sub && <p className="arco-eyebrow" style={{ margin: "0 0 8px" }}>{sub}</p>}
              <h3 className="arco-section-title" style={{ margin: 0 }}>{title}</h3>
              {status && (
                <p className="showroom-popup-status" data-open={status.open ? "true" : undefined}>
                  <span aria-hidden className="showroom-popup-dot" />
                  {status.text}
                </p>
              )}
            </div>
            {!loc.imageUrl && (
              <button type="button" className="showroom-popup-close" onClick={onClose} aria-label={copy.close}>
                <X size={18} strokeWidth={1.75} />
              </button>
            )}
          </div>

          <dl className="showroom-popup-rows">
            {owner && (
              <div className="showroom-popup-row">
                <dt className="arco-eyebrow">{copy.owner}</dt>
                <dd><Link href={owner.href} className="text-link-plain no-underline">{owner.name} →</Link></dd>
              </div>
            )}
            {addressText && (
              <div className="showroom-popup-row">
                <dt className="arco-eyebrow">{copy.address}</dt>
                <dd>
                  {hasMaps ? (
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-link-plain">{addressText} →</a>
                  ) : addressText}
                </dd>
              </div>
            )}
            {loc.phone && (
              <div className="showroom-popup-row">
                <dt className="arco-eyebrow">{copy.phone}</dt>
                <dd><a href={`tel:${loc.phone.replace(/\s+/g, "")}`} className="text-link-plain">{loc.phone}</a></dd>
              </div>
            )}
            {website && loc.website && (
              <div className="showroom-popup-row">
                <dt className="arco-eyebrow">{copy.website}</dt>
                <dd><a href={loc.website} target="_blank" rel="noopener noreferrer" className="text-link-plain">{website} →</a></dd>
              </div>
            )}
            {loc.openingHours && (
              <div className="showroom-popup-row">
                <dt className="arco-eyebrow">{copy.hours}</dt>
                <dd>
                  {week ? (
                    <table className="showroom-popup-hours">
                      <tbody>
                        {groupWeek(week, locale).map((g) => {
                          const isToday = status != null && status.today >= g.from && status.today <= g.to
                          return (
                            <tr key={g.days} data-today={isToday ? "true" : undefined} data-closed={g.closed ? "true" : undefined}>
                              <th scope="row">{g.days}</th>
                              <td>{g.hours}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <span style={{ whiteSpace: "pre-line" }}>{loc.openingHours}</span>
                  )}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {(hasMaps || loc.phone) && (
          <div className="showroom-popup-actions">
            {hasMaps && (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">{copy.route}</a>
            )}
            {loc.phone && (
              <a href={`tel:${loc.phone.replace(/\s+/g, "")}`} className="btn-secondary">{copy.call}</a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
