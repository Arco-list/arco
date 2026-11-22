"use client"

import { ShowroomPicker } from "@/components/showroom-picker"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useLocale } from "next-intl"
import { toast } from "sonner"

import { LocationPopup } from "@/components/location-form"
import { locationKindLabel, type LocationInput, type LocationRecord } from "@/lib/locations/types"
import { deleteCompanyLocationAction, saveCompanyLocationAction, uploadCompanyLocationPhotoAction } from "@/app/dashboard/company/actions"
import { LocationCards } from "@/components/locations/location-cards"

/**
 * "Vestigingen" in de bedrijfseditor: showrooms, winkels, kantoren en
 * werkplaatsen (tabel locations). Het hoofdadres in het contactblok
 * blijft de plek voor zoeken en facetten; dit zijn de plekken waar een
 * bezoeker langs kan.
 */

const COPY = {
  nl: {
    title: "Showrooms",
    titleOne: "Showroom",
    intro: "Plekken waar klanten langs kunnen komen. Bij je merken tonen we ze als verkooppunt.",
    add: "Showroom toevoegen",
    empty: "Nog geen vestigingen.",
    emptyHint: "Heb je een showroom of winkel? Voeg die hier toe met adres en openingstijden.",
    edit: "Bewerken",
    saved: "Showroom opgeslagen",
    photoSaved: "Foto opgeslagen",
    addedMany: (n: number) => (n === 1 ? "Showroom toegevoegd" : `${n} showrooms toegevoegd`),
    deleted: "Showroom verwijderd",
    confirm: "Deze showroom verwijderen?",
    error: "Opslaan mislukt",
  },
  en: {
    title: "Showrooms",
    titleOne: "Showroom",
    intro: "Places customers can visit. We show them as points of sale with your brands.",
    add: "Add showroom",
    empty: "No locations yet.",
    emptyHint: "Have a showroom or store? Add it here with address and opening hours.",
    edit: "Edit",
    saved: "Showroom saved",
    photoSaved: "Photo saved",
    addedMany: (n: number) => (n === 1 ? "Showroom added" : `${n} showrooms added`),
    deleted: "Showroom removed",
    confirm: "Remove this showroom?",
    error: "Could not save",
  },
}

export function CompanyLocationsSection({ companyId, companyName, logoUrl, locations }: { companyId: string; companyName?: string | null; logoUrl?: string | null; locations: LocationRecord[] }) {
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

  // Meerdere showrooms in één keer, uit de keuzelijst.
  const addMany = async (inputs: LocationInput[]) => {
    setSaving(true)
    let ok = 0
    for (const input of inputs) {
      const result = await saveCompanyLocationAction(input, companyId)
      if (result.success) ok += 1
      else toast.error(result.error ?? c.error)
    }
    setSaving(false)
    if (ok > 0) toast.success(c.addedMany(ok))
    setPopup({ open: false, editing: null })
    router.refresh()
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
        {/* Titel en intro als één blok, zoals de secties in de projecteditor
            (Fototour, Vermelde professionals): intro 6px onder de titel. */}
        <div style={{ marginBottom: 28, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h2 className="arco-section-title">{locations.length === 1 ? c.titleOne : c.title}</h2>
            <p className="arco-body-text" style={{ color: "#8c8c8a", marginTop: 6, marginBottom: 0, maxWidth: 600 }}>{c.intro}</p>
          </div>
          <button type="button" className="btn-primary" style={{ fontSize: 13, padding: "8px 18px" }} onClick={() => setPopup({ open: true, editing: null })}>
            {c.add}
          </button>
        </div>

        {/* Leeg: geen kader, de knop en de intro zeggen genoeg. */}
        {locations.length === 0 ? null : (
          <LocationCards
            mode="edit"
            locations={locations}
            fallbackLogoUrl={logoUrl}
            onEdit={(loc) => setPopup({ open: true, editing: loc })}
            onUpload={async (loc, file) => {
              const fd = new FormData()
              fd.set("file", file)
              fd.set("locationId", loc.id)
              const result = await uploadCompanyLocationPhotoAction(fd, companyId)
              if (!result.success) { toast.error(result.error ?? c.error); return }
              toast.success(c.photoSaved)
              router.refresh()
            }}
          />
        )}
      </div>

      {popup.open && !popup.editing && (
        <ShowroomPicker
          suggestFor={companyName}
          existingPlaceIds={locations.map((l) => l.googlePlaceId).filter((id): id is string => Boolean(id))}
          onAdd={addMany}
          onClose={() => !saving && setPopup({ open: false, editing: null })}
        />
      )}
      {popup.open && popup.editing && (
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
