"use client"

import { useCallback, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Plus } from "lucide-react"

import { useAuth } from "@/contexts/auth-context"
import { useCreateCompanyModal } from "@/contexts/create-company-modal-context"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import {
  sendDomainVerificationAction,
  verifyDomainCodeAction,
  createCompanyFromPlacesAction,
  claimCompanyAction,
  type GooglePlaceData,
} from "@/app/create-company/actions"

const BLOCKED_EMAIL_DOMAINS = ["gmail.com", "hotmail.com", "yahoo.com", "outlook.com", "icloud.com"]

type Step = "search" | "verify" | "creating"

type ArcoCompanyResult = { id: string; name: string; city: string | null; slug: string | null; owner_id: string | null; domain: string | null; website: string | null }
type GooglePlaceResult = { placeId: string; name: string; city: string | null }

function extractDomainFromUrl(input: string): string | null {
  if (!input) return null
  try {
    const url = input.startsWith("http") ? input : `https://${input}`
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

export function CreateCompanyModal() {
  const router = useRouter()
  const { user, refreshProfile } = useAuth()
  const { isOpen, closeCreateCompanyModal } = useCreateCompanyModal()
  const supabase = useMemo(() => getBrowserSupabaseClient(), [])

  const [step, setStep] = useState<Step>("search")
  const [placeData, setPlaceData] = useState<GooglePlaceData | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Search state
  const [searchQuery, setSearchQuery] = useState("")
  const [arcoResults, setArcoResults] = useState<ArcoCompanyResult[]>([])
  const [googleResults, setGoogleResults] = useState<GooglePlaceResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const googleService = useRef<any>(null)

  // Claiming state (for unowned Arco companies)
  const [claimingCompanyId, setClaimingCompanyId] = useState<string | null>(null)

  // Verification state
  const [verifyEmail, setVerifyEmail] = useState("")
  const [verifyCode, setVerifyCode] = useState("")
  const [codeSent, setCodeSent] = useState(false)
  const [manualWebsite, setManualWebsite] = useState("")

  const [isPending, startTransition] = useTransition()

  const resetState = useCallback(() => {
    setStep("search")
    setPlaceData(null)
    setError(null)
    setSearchQuery("")
    setArcoResults([])
    setGoogleResults([])
    setIsSearching(false)
    setClaimingCompanyId(null)
    setVerifyEmail("")
    setVerifyCode("")
    setCodeSent(false)
    setManualWebsite("")
    googleService.current = null
  }, [])

  const handleClose = useCallback(() => {
    if (step === "creating") return
    closeCreateCompanyModal()
    setTimeout(resetState, 300)
  }, [step, closeCreateCompanyModal, resetState])

  // Search: Arco DB + Google Places in parallel (same pattern as project edit page)
  const searchCompanies = useCallback((query: string) => {
    setSearchQuery(query)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (query.trim().length < 2) {
      setArcoResults([])
      setGoogleResults([])
      return
    }

    searchTimer.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const dbPromise = supabase
          .from("companies")
          .select("id, name, city, slug, owner_id, domain, website")
          .ilike("name", `%${query.trim()}%`)
          .limit(6)

        const googlePromise = (async (): Promise<GooglePlaceResult[]> => {
          try {
            const g = (window as any).google
            if (!g?.maps) return []

            if (!googleService.current) {
              const placesLib = await g.maps.importLibrary("places")
              if (!placesLib?.AutocompleteService) return []
              googleService.current = new placesLib.AutocompleteService()
            }

            const predictions = await new Promise<any>((resolve) => {
              googleService.current.getPlacePredictions(
                { input: query.trim(), types: ["establishment"], componentRestrictions: { country: "nl" } },
                (preds: any, status: string) => {
                  resolve(status === "OK" && preds ? preds : [])
                },
              )
            })

            return predictions.slice(0, 5).map((p: any) => ({
              placeId: p.place_id,
              name: p.structured_formatting?.main_text ?? p.description ?? "",
              city: (() => {
                const parts = (p.structured_formatting?.secondary_text ?? "").split(",").map((s: string) => s.trim())
                return parts.length >= 2 ? parts[parts.length - 2] : parts[0] || null
              })(),
            }))
          } catch {
            return []
          }
        })()

        const [dbResult, googleData] = await Promise.all([dbPromise, googlePromise])
        const dbData = (dbResult.data ?? []) as ArcoCompanyResult[]

        // Check which Google results already have a matching google_place_id in our DB
        const googlePlaceIds = googleData.map((g) => g.placeId).filter(Boolean)
        let existingPlaceIds = new Set<string>()
        if (googlePlaceIds.length > 0) {
          const { data: placeMatches } = await supabase
            .from("companies")
            .select("id, google_place_id, name, city, owner_id, domain, website")
            .in("google_place_id", googlePlaceIds)
          if (placeMatches?.length) {
            existingPlaceIds = new Set(placeMatches.map((m) => m.google_place_id).filter(Boolean) as string[])
            // Add place-matched companies to Arco results
            for (const m of placeMatches) {
              if (!dbData.some((d) => d.name.toLowerCase() === m.name?.toLowerCase())) {
                dbData.push({ id: m.id, name: m.name!, city: m.city ?? null, slug: null, owner_id: m.owner_id ?? null, domain: m.domain ?? null, website: m.website ?? null })
              }
            }
          }
        }

        setArcoResults(dbData)

        // Deduplicate: remove Google results matching DB names or existing place IDs
        const dbNames = new Set(dbData.map((c) => c.name.toLowerCase()))
        setGoogleResults(googleData.filter((g) => !dbNames.has(g.name.toLowerCase()) && !existingPlaceIds.has(g.placeId)))
      } catch {
        setArcoResults([])
        setGoogleResults([])
      }
      setIsSearching(false)
    }, 300)
  }, [supabase])

  // Handle selecting a Google Places result — fetch full details
  const handleSelectGoogleResult = useCallback(async (result: GooglePlaceResult) => {
    try {
      const g = (window as any).google
      if (!g?.maps) return

      const placesLib = await g.maps.importLibrary("places")
      const div = document.createElement("div")
      const service = new placesLib.PlacesService(div)

      const place = await new Promise<any>((resolve, reject) => {
        service.getDetails(
          {
            placeId: result.placeId,
            fields: ["name", "place_id", "formatted_address", "address_components", "formatted_phone_number", "website", "editorial_summary", "types"],
          },
          (place: any, status: string) => {
            if (status === "OK" && place) resolve(place)
            else reject(new Error("Failed to get place details"))
          },
        )
      })

      let city = ""
      let country = ""
      let stateRegion = ""
      for (const comp of place.address_components ?? []) {
        if (comp.types.includes("locality")) city = comp.long_name
        if (comp.types.includes("country")) country = comp.long_name
        if (comp.types.includes("administrative_area_level_1")) stateRegion = comp.long_name
      }

      let domain: string | null = null
      let website: string | null = place.website ?? null
      if (website) {
        try { domain = new URL(website).hostname.replace(/^www\./, "") } catch { domain = null }
      }

      const data: GooglePlaceData = {
        name: place.name,
        placeId: place.place_id,
        formattedAddress: place.formatted_address ?? null,
        city: city || null,
        country: country || null,
        stateRegion: stateRegion || null,
        phone: place.formatted_phone_number ?? null,
        website,
        domain,
        editorialSummary: place.editorial_summary?.text ?? null,
        googleTypes: place.types ?? null,
      }

      setPlaceData(data)
      setError(null)
      setVerifyEmail("")
      setVerifyCode("")
      setCodeSent(false)
      setManualWebsite("")
      setStep("verify")
    } catch (e) {
      console.error("Failed to get Google place details:", e)
      toast.error("Could not load company details. Please try again.")
    }
  }, [])

  // Handle selecting an unowned Arco company to claim
  const handleSelectClaimableCompany = useCallback((company: ArcoCompanyResult) => {
    const domain = company.domain || (company.website ? extractDomainFromUrl(company.website) : null)
    setPlaceData({
      name: company.name,
      placeId: "",
      formattedAddress: null,
      city: company.city,
      country: null,
      stateRegion: null,
      phone: null,
      website: company.website,
      domain,
      editorialSummary: null,
      googleTypes: null,
    })
    setClaimingCompanyId(company.id)
    setError(null)
    setVerifyEmail("")
    setVerifyCode("")
    setCodeSent(false)
    setManualWebsite("")
    setStep("verify")
  }, [])

  const handleBackToSearch = () => {
    setStep("search")
    setPlaceData(null)
    setClaimingCompanyId(null)
    setError(null)
    setVerifyEmail("")
    setVerifyCode("")
    setCodeSent(false)
    setManualWebsite("")
  }

  // Auto-verify check
  const userEmailDomain = user?.email?.split("@")[1]?.toLowerCase() ?? ""
  const companyDomain = placeData?.domain?.toLowerCase() ?? ""
  const isAutoVerified = !!(companyDomain && userEmailDomain === companyDomain)
  const hasWebsite = !!placeData?.domain

  const handleSendCode = () => {
    if (!placeData) return
    setError(null)

    const emailDomain = verifyEmail.split("@")[1]?.toLowerCase()
    const targetDomain = placeData.domain || extractDomainFromUrl(manualWebsite)

    if (!targetDomain) { setError("Please enter a website first."); return }
    if (!emailDomain || emailDomain !== targetDomain.toLowerCase()) { setError(`Email must end with @${targetDomain}`); return }
    if (BLOCKED_EMAIL_DOMAINS.includes(emailDomain)) { setError("Please use a company email address."); return }

    startTransition(async () => {
      const result = await sendDomainVerificationAction({ domain: targetDomain, email: verifyEmail, companyName: placeData.name })
      if (result.success) { setCodeSent(true); toast.success("Verification code sent") }
      else { setError(result.error ?? "Failed to send code.") }
    })
  }

  const handleVerifyCode = () => {
    if (!placeData) return
    setError(null)
    const targetDomain = placeData.domain || extractDomainFromUrl(manualWebsite)
    if (!targetDomain) return

    startTransition(async () => {
      const result = await verifyDomainCodeAction({ domain: targetDomain, code: verifyCode })
      if (result.verified) handleCreateCompany(targetDomain)
      else setError(result.error ?? "Invalid code.")
    })
  }

  const handleCreateCompany = (overrideDomain?: string) => {
    if (!placeData) return
    setError(null)
    setStep("creating")

    const finalDomain = overrideDomain || placeData.domain
    const finalWebsite = placeData.website || (manualWebsite ? `https://${manualWebsite.replace(/^https?:\/\//, "")}` : null)

    startTransition(async () => {
      let result: { success: boolean; error?: string }

      if (claimingCompanyId) {
        // Claiming an existing unowned company
        result = await claimCompanyAction({ companyId: claimingCompanyId, domain: finalDomain || undefined })
      } else {
        // Creating a new company from Google Places
        result = await createCompanyFromPlacesAction({ ...placeData, domain: finalDomain || null, website: finalWebsite })
      }

      if (result.success) {
        await refreshProfile()
        closeCreateCompanyModal()
        router.push("/dashboard/company")
        setTimeout(resetState, 300)
      } else {
        setError(result.error ?? "Failed to create company.")
        setStep("verify")
      }
    })
  }

  if (!isOpen) return null

  const hasResults = arcoResults.length > 0 || googleResults.length > 0
  const showDropdown = searchQuery.trim().length >= 2

  const stepTitle = step === "search" ? "Create your company page" : step === "verify" ? (claimingCompanyId ? "Claim your company" : "Verify your company") : (claimingCompanyId ? "Claiming company" : "Creating company")
  const showBack = step === "verify"

  return (
    <>
      <style>{`
        .ccm-dropdown { border: 1px solid var(--arco-rule); border-radius: 3px; box-shadow: 0 8px 28px rgba(0,0,0,.14); max-height: 280px; overflow-y: auto; padding: 4px 0; background: #fff; }
        .ccm-row { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 9px 14px; font-size: 13px; font-weight: 300; color: var(--arco-black); cursor: pointer; gap: 8px; transition: background .1s; background: none; border: none; text-align: left; }
        .ccm-row:hover { background: var(--arco-off-white); }
        .ccm-row.disabled { opacity: .55; cursor: default; }
        .ccm-row.disabled:hover { background: none; }
        .ccm-divider { height: 1px; background: var(--arco-rule); margin: 4px 0; }
        .ccm-badge { font-size: 9px; font-weight: 600; letter-spacing: .04em; padding: 1px 5px; border-radius: 3px; text-transform: uppercase; flex-shrink: 0; }
        .ccm-badge.arco { background: rgba(1,109,117,.1); color: #016D75; }
        .ccm-badge.google { background: rgba(66,133,244,.1); color: #4285F4; }
        .ccm-badge.claim { background: rgba(234,179,8,.12); color: #a16207; }
        .ccm-add { display: flex; align-items: center; gap: 7px; width: 100%; padding: 9px 14px; font-size: 13px; font-weight: 400; color: #016D75; cursor: pointer; background: none; border: none; text-align: left; transition: background .1s; }
        .ccm-add:hover { background: #f0fafa; }
      `}</style>

      <div className="popup-overlay" onClick={handleClose}>
        <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, padding: 0, display: "flex", flexDirection: "column" }}>
          {/* Header — grey background */}
          <div
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "20px 28px",
              background: "var(--arco-off-white)", borderRadius: "12px 12px 0 0", flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {showBack && (
                <button
                  type="button"
                  className="popup-close"
                  onClick={handleBackToSearch}
                  style={{ fontSize: 16, display: "flex" }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 12L6 8L10 4" />
                  </svg>
                </button>
              )}
              <h3 className="arco-section-title" style={{ margin: 0 }}>{stepTitle}</h3>
            </div>
            <button type="button" className="popup-close" onClick={handleClose} aria-label="Close">
              ✕
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: "12px 28px 28px" }}>

            {/* Search step */}
            {step === "search" && (
              <div>
                <p className="arco-body-text" style={{ color: "var(--arco-mid-grey)", marginBottom: 16 }}>
                  Search for your company to get started
                </p>

                <input
                  type="text"
                  className="form-input"
                  placeholder="Search for your company..."
                  value={searchQuery}
                  onChange={(e) => searchCompanies(e.target.value)}
                  autoFocus
                  style={{ marginBottom: 0 }}
                />

                {/* Results dropdown */}
                {showDropdown && (
                  <div className="ccm-dropdown" style={{ marginTop: 8 }}>
                    {arcoResults.map((c) => {
                      const isOwned = !!c.owner_id
                      return (
                        <button
                          key={c.id}
                          type="button"
                          className={`ccm-row${isOwned ? " disabled" : ""}`}
                          onClick={() => {
                            if (isOwned) {
                              toast.info("This company is already on Arco", { description: "Contact the admin of this company to be added as a team member." })
                            } else {
                              handleSelectClaimableCompany(c)
                            }
                          }}
                        >
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}{c.city ? ` · ${c.city}` : ""}</span>
                          <span className={`ccm-badge ${isOwned ? "arco" : "claim"}`}>{isOwned ? "On Arco" : "Claim"}</span>
                        </button>
                      )
                    })}

                    {arcoResults.length > 0 && googleResults.length > 0 && <div className="ccm-divider" />}

                    {googleResults.map((g) => (
                      <button
                        key={g.placeId}
                        type="button"
                        className="ccm-row"
                        onClick={() => handleSelectGoogleResult(g)}
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}{g.city ? ` · ${g.city}` : ""}</span>
                        <span className="ccm-badge google">Google</span>
                      </button>
                    ))}

                    {searchQuery.trim().length >= 2 && !isSearching && !arcoResults.some((c) => c.name.toLowerCase() === searchQuery.trim().toLowerCase()) && (
                      <>
                        {hasResults && <div className="ccm-divider" />}
                        <button
                          type="button"
                          className="ccm-add"
                          onClick={() => toast.info("Manual company creation coming soon")}
                        >
                          <Plus size={12} />
                          <span>Add &ldquo;{searchQuery.trim()}&rdquo;</span>
                        </button>
                      </>
                    )}

                    {isSearching && (
                      <div className="ccm-row" style={{ color: "var(--arco-mid-grey)", cursor: "default" }}>Searching...</div>
                    )}

                    {!isSearching && !hasResults && searchQuery.trim().length >= 2 && (
                      <div className="ccm-row" style={{ color: "var(--arco-mid-grey)", cursor: "default" }}>No companies found</div>
                    )}
                  </div>
                )}

                {searchQuery.trim().length < 2 && (
                  <p style={{ fontSize: 13, color: "var(--arco-mid-grey)", marginTop: 8 }}>
                    Start typing your company name to search
                  </p>
                )}
              </div>
            )}

            {/* Verify step */}
            {step === "verify" && placeData && (
              <div>
                <p className="arco-body-text" style={{ color: "var(--arco-mid-grey)", marginBottom: 16 }}>
                  {claimingCompanyId
                    ? "Verify domain ownership to claim this company page"
                    : "Confirm you own this company before creating your page"}
                </p>

                {/* Company preview card */}
                <div style={{ border: "1px solid var(--arco-rule)", background: "var(--arco-off-white)", padding: 16, borderRadius: 3, marginBottom: 20 }}>
                  <p style={{ fontSize: 15, fontWeight: 500, color: "var(--arco-black)" }}>{placeData.name}</p>
                  {placeData.formattedAddress && (
                    <p style={{ fontSize: 13, color: "var(--arco-mid-grey)", marginTop: 4 }}>{placeData.formattedAddress}</p>
                  )}
                  {placeData.website && (
                    <p style={{ fontSize: 13, color: "var(--arco-mid-grey)", marginTop: 2 }}>{placeData.website}</p>
                  )}
                </div>

                {/* Auto-verified */}
                {isAutoVerified && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 3, marginBottom: 20 }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: "#059669", flexShrink: 0 }}>
                        <path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <p style={{ fontSize: 13, color: "#065f46" }}>
                        Your email ({user?.email}) matches <strong style={{ fontWeight: 500 }}>{companyDomain}</strong>. Domain verified.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => handleCreateCompany()}
                      disabled={isPending}
                      style={{ width: "100%", fontSize: 14, padding: "12px 20px" }}
                    >
                      {isPending ? "Creating..." : "Continue"}
                    </button>
                  </div>
                )}

                {/* Email verification needed */}
                {!isAutoVerified && hasWebsite && (
                  <div>
                    <p style={{ fontSize: 14, color: "var(--arco-mid-grey)", marginBottom: 16 }}>
                      To verify ownership, enter your company email ending with <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>@{companyDomain}</strong>.
                    </p>
                    {!codeSent ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <input
                          type="email"
                          className="form-input"
                          value={verifyEmail}
                          onChange={(e) => setVerifyEmail(e.target.value)}
                          placeholder={`yourname@${companyDomain}`}
                          autoFocus
                          style={{ marginBottom: 0 }}
                        />
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={handleSendCode}
                          disabled={isPending || !verifyEmail}
                          style={{ width: "100%", fontSize: 14, padding: "12px 20px" }}
                        >
                          {isPending ? "Sending..." : "Send code"}
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <p style={{ fontSize: 14, color: "var(--arco-mid-grey)" }}>
                          We sent a 6-digit code to <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>{verifyEmail}</strong>.
                        </p>
                        <input
                          type="text"
                          className="form-input"
                          inputMode="numeric"
                          maxLength={6}
                          value={verifyCode}
                          onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                          placeholder="000000"
                          autoFocus
                          style={{ marginBottom: 0, textAlign: "center", letterSpacing: "0.3em" }}
                        />
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <button
                            type="button"
                            onClick={handleSendCode}
                            disabled={isPending}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--arco-mid-grey)", textDecoration: "underline" }}
                          >
                            Resend code
                          </button>
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={handleVerifyCode}
                            disabled={isPending || verifyCode.length !== 6}
                            style={{ fontSize: 14, padding: "10px 20px" }}
                          >
                            {isPending ? "Verifying..." : "Verify"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* No website — manual domain input */}
                {!isAutoVerified && !hasWebsite && (
                  <div>
                    <p style={{ fontSize: 14, color: "var(--arco-mid-grey)", marginBottom: 16 }}>
                      No website found for this company. Enter your company website to verify ownership.
                    </p>
                    <input
                      type="text"
                      className="form-input"
                      value={manualWebsite}
                      onChange={(e) => setManualWebsite(e.target.value)}
                      placeholder="www.yourcompany.com"
                      autoFocus
                      style={{ marginBottom: 0 }}
                    />

                    {manualWebsite && extractDomainFromUrl(manualWebsite) && (
                      <div style={{ marginTop: 16 }}>
                        <p style={{ fontSize: 14, color: "var(--arco-mid-grey)", marginBottom: 16 }}>
                          Enter your email ending with <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>@{extractDomainFromUrl(manualWebsite)}</strong>.
                        </p>
                        {!codeSent ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            <input
                              type="email"
                              className="form-input"
                              value={verifyEmail}
                              onChange={(e) => setVerifyEmail(e.target.value)}
                              placeholder={`yourname@${extractDomainFromUrl(manualWebsite)}`}
                              style={{ marginBottom: 0 }}
                            />
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={handleSendCode}
                              disabled={isPending || !verifyEmail}
                              style={{ width: "100%", fontSize: 14, padding: "12px 20px" }}
                            >
                              {isPending ? "Sending..." : "Send code"}
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            <p style={{ fontSize: 14, color: "var(--arco-mid-grey)" }}>
                              We sent a 6-digit code to <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>{verifyEmail}</strong>.
                            </p>
                            <input
                              type="text"
                              className="form-input"
                              inputMode="numeric"
                              maxLength={6}
                              value={verifyCode}
                              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                              placeholder="000000"
                              autoFocus
                              style={{ marginBottom: 0, textAlign: "center", letterSpacing: "0.3em" }}
                            />
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <button
                                type="button"
                                onClick={handleSendCode}
                                disabled={isPending}
                                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--arco-mid-grey)", textDecoration: "underline" }}
                              >
                                Resend code
                              </button>
                              <button
                                type="button"
                                className="btn-primary"
                                onClick={handleVerifyCode}
                                disabled={isPending || verifyCode.length !== 6}
                                style={{ fontSize: 14, padding: "10px 20px" }}
                              >
                                {isPending ? "Verifying..." : "Verify"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {error && <p style={{ fontSize: 13, color: "#dc2626", marginTop: 12 }}>{error}</p>}
              </div>
            )}

            {/* Creating step */}
            {step === "creating" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 0" }}>
                <Loader2 style={{ width: 24, height: 24, animation: "spin 1s linear infinite", color: "var(--arco-black)", marginBottom: 16 }} />
                <p style={{ fontSize: 15, color: "var(--arco-mid-grey)" }}>{claimingCompanyId ? "Claiming your company page..." : "Setting up your company page..."}</p>
                {error && (
                  <div style={{ marginTop: 16, textAlign: "center" }}>
                    <p style={{ fontSize: 13, color: "#dc2626", marginBottom: 12 }}>{error}</p>
                    <button
                      type="button"
                      onClick={() => setStep("verify")}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--arco-mid-grey)", textDecoration: "underline" }}
                    >
                      Try again
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
