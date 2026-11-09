"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useLocale } from "next-intl"
import { toast } from "sonner"

import { LocationPopup } from "@/components/location-form"
import { locationKindLabel, type LocationInput, type LocationRecord } from "@/lib/locations/types"
import { deleteCompanyLocationAction, saveCompanyLocationAction } from "@/app/dashboard/company/actions"

/**
 * "Vestigingen" in de bedrijfseditor: showrooms, winkels, kantoren en
 * werkplaatsen (tabel locations). Het hoofdadres in het contactblok
 * blijft de plek voor zoeken en facetten; dit zijn de plekken waar een
 * bezoeker langs kan.
 */

const COPY = {
  nl: {
    title: "Vestigingen",
    intro: "Showrooms en winkels waar bezoekers langs kunnen. Ze staan onder je projecten op je pagina.",
    add: "Vestiging toevoegen",
    empty: "Nog geen vestigingen.",
    emptyHint: "Heb je een showroom of winkel? Voeg die hier toe met adres en openingstijden.",
    edit: "Bewerken",
    saved: "Vestiging opgeslagen",
    deleted: "Vestiging verwijderd",
    confirm: "Deze vestiging verwijderen?",
    error: "Opslaan mislukt",
  },
  en: {
    title: "Locations",
    intro: "Showrooms and stores visitors can walk into. They sit under your projects on your page.",
    add: "Add location",
    empty: "No locations yet.",
    emptyHint: "Have a showroom or store? Add it here with address and opening hours.",
    edit: "Edit",
    saved: "Location saved",
    deleted: "Location removed",
    confirm: "Remove this location?",
    error: "Could not save",
  },
}

export function CompanyLocationsSection({ companyId, locations }: { companyId: string; locations: LocationRecord[] }) {
  const locale = useLocale()
  const c = locale === "nl" ? COPY.nl : COPY.en
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [popup, setPopup] = useState<{ open: boolean; editing: LocationRecord | null }>({ open: false, editing: null })
  const [saving, setSaving] = useState(false)

  const save = (input: LocationInput) => {
    setSaving(true)
    startTransition(async () => {
      const result = await saveCompanyLocationAction(input, companyId)
      setSaving(false)
      if (!result.success) { toast.error(result.error ?? c.error); return }
      toast.success(c.saved)
      setPopup({ open: false, editing: null })
      router.refresh()
    })
  }

  const remove = (id: string) => {
    if (!window.confirm(c.confirm)) return
    setSaving(true)
    startTransition(async () => {
      const result = await deleteCompanyLocationAction({ id }, companyId)
      setSaving(false)
      if (!result.success) { toast.error(result.error ?? c.error); return }
      toast.success(c.deleted)
      setPopup({ open: false, editing: null })
      router.refresh()
    })
  }

  return (
    <section id="locations" style={{ marginBottom: 60 }}>
      <div className="wrap">
        <div className="section-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 className="arco-section-title">{c.title}</h2>
          <button type="button" className="btn-primary" style={{ fontSize: 13, padding: "8px 18px" }} onClick={() => setPopup({ open: true, editing: null })}>
            {c.add}
          </button>
        </div>
        <p className="arco-body-text" style={{ color: "#8c8c8a", marginBottom: 24, maxWidth: 600 }}>{c.intro}</p>

        {locations.length === 0 ? (
          <div style={{ border: "1px dashed var(--border)", borderRadius: 8, padding: "48px 24px", textAlign: "center" }}>
            <p className="arco-eyebrow" style={{ marginBottom: 8 }}>{c.empty}</p>
            <p className="arco-body-text" style={{ color: "#a1a1a0", margin: "0 auto", maxWidth: 420 }}>{c.emptyHint}</p>
          </div>
        ) : (
          <div className="contact-grid">
            {locations.map((loc) => {
              const street = loc.streetAddress ?? loc.address?.split(",")[0]?.trim() ?? null
              const cityLine = [loc.postalCode, loc.city].filter(Boolean).join(" ")
              return (
                <button
                  key={loc.id}
                  type="button"
                  className="contact-card"
                  onClick={() => setPopup({ open: true, editing: loc })}
                  style={{ background: "none", border: "1px solid transparent", borderRadius: 6, padding: 12, margin: -12, cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#e5e5e4" }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent" }}
                >
                  <span className="arco-eyebrow">{locationKindLabel(loc.kind, locale)}</span>
                  <p className="arco-card-title" style={{ margin: "12px 0 4px" }}>{loc.name ?? loc.city ?? street}</p>
                  {street && <p className="arco-body-text" style={{ margin: 0 }}>{street}</p>}
                  {cityLine && <p className="arco-body-text" style={{ margin: 0 }}>{cityLine}</p>}
                  {loc.openingHours && <p className="arco-body-text" style={{ margin: "8px 0 0", color: "#6b6b68", whiteSpace: "pre-line" }}>{loc.openingHours}</p>}
                  <span style={{ display: "inline-block", marginTop: 10, fontSize: 12, color: "#a1a1a0" }}>{c.edit} →</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {popup.open && (
        <LocationPopup
          initial={popup.editing}
          saving={saving}
          onSave={save}
          onClose={() => !saving && setPopup({ open: false, editing: null })}
          onDelete={popup.editing ? () => remove(popup.editing!.id) : undefined}
        />
      )}
    </section>
  )
}
