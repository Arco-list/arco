"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { adminAddClaimableCompanyAction } from "@/app/admin/companies/add-company-actions"

/**
 * The lean "Add company" modal — creates a claimable shell only (status
 * 'added', source 'admin', no contact, no sales presence). Counterpart
 * of AdminAddCompanyModal, which is the "Add showcase" path.
 */
export function AdminAddClaimableCompanyModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [website, setWebsite] = useState("")
  const [city, setCity] = useState("")
  const [busy, setBusy] = useState(false)

  if (!isOpen) return null

  const submit = async () => {
    if (busy) return
    setBusy(true)
    const result = await adminAddClaimableCompanyAction({ name, website, city: city || null })
    setBusy(false)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success(result.adopted
      ? "Domain already existed — adopted the existing unclaimed company."
      : "Company added — claimable in the signup flow.")
    setName(""); setWebsite(""); setCity("")
    onClose()
    router.refresh()
  }

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="popup-header">
          <h3 className="arco-section-title">Add company</h3>
          <button type="button" className="popup-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="arco-body-text" style={{ marginBottom: 20 }}>
          Creates a claimable company only — no contact, no outreach, hidden
          from the default table until claimed. The website is required: the
          domain is the claim proof.
        </p>

        <label className="form-label">Company name</label>
        <input className="form-input" style={{ marginBottom: 14 }} value={name}
          onChange={(e) => setName(e.target.value)} placeholder="Studio Voorbeeld" autoFocus />

        <label className="form-label">Website</label>
        <input className="form-input" style={{ marginBottom: 14 }} value={website}
          onChange={(e) => setWebsite(e.target.value)} placeholder="studiovoorbeeld.nl" type="url" />

        <label className="form-label">City (optional)</label>
        <input className="form-input" style={{ marginBottom: 20 }} value={city}
          onChange={(e) => setCity(e.target.value)} placeholder="Amsterdam" />

        <button
          type="button"
          className="btn-primary"
          style={{ width: "100%", fontSize: 14, padding: "12px 20px", opacity: busy || !name.trim() || !website.trim() ? 0.5 : 1 }}
          disabled={busy || !name.trim() || !website.trim()}
          onClick={submit}
        >
          {busy ? "Adding…" : "Add company"}
        </button>
      </div>
    </div>
  )
}
