"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import { useLoginModal } from "@/contexts/login-modal-context"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import { checkDomainOwnership, autoCreateCompanyFromDomain, type DomainCheckResult } from "@/app/businesses/actions"
import { sendDomainVerificationAction, verifyDomainCodeAction } from "@/app/create-company/actions"
import { ImportProjectModal } from "@/components/import-project-modal"

type Phase =
  | "idle"
  | "checking-domain"
  | "domain-claimed"
  | "awaiting-auth"
  | "creating-company"
  | "verifying-domain"
  | "importing"

interface ImportFlowOrchestratorProps {
  pendingUrl: string | null
  onReset: () => void
}

export function ImportFlowOrchestrator({ pendingUrl, onReset }: ImportFlowOrchestratorProps) {
  const router = useRouter()
  const { user } = useAuth()
  const { openLoginModal } = useLoginModal()
  const supabase = useMemo(() => getBrowserSupabaseClient(), [])

  const [phase, setPhase] = useState<Phase>("idle")
  const [domainResult, setDomainResult] = useState<DomainCheckResult | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [professionalId, setProfessionalId] = useState<string | null>(null)
  const [companyDomain, setCompanyDomain] = useState<string | null>(null)
  const [isVerified, setIsVerified] = useState(false)
  const [claimableCompanyId, setClaimableCompanyId] = useState<string | null>(null)

  // Domain verification state
  const [verifyEmail, setVerifyEmail] = useState("")
  const [verifyCode, setVerifyCode] = useState("")
  const [verifyCodeSent, setVerifyCodeSent] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  const urlDomain = useMemo(() => {
    if (!pendingUrl) return null
    try {
      return new URL(pendingUrl).hostname.replace(/^www\./, "").toLowerCase()
    } catch {
      return null
    }
  }, [pendingUrl])

  // Track whether we're waiting for auth to complete
  const wasWaitingForAuth = useRef(false)

  // Step 1: When a URL is submitted, check domain ownership
  useEffect(() => {
    if (!pendingUrl) {
      setPhase("idle")
      return
    }
    if (phase !== "idle") return

    setPhase("checking-domain")
    checkDomainOwnership(pendingUrl).then((result) => {
      setDomainResult(result)

      if (result.status === "invalid") {
        toast.error("Please enter a valid URL.")
        onReset()
        return
      }

      if (result.status === "owned") {
        // User owns this domain — go straight to import
        setCompanyId(result.companyId)
        setProfessionalId(result.professionalId)
        setPhase("importing")
        return
      }

      if (result.status === "claimed") {
        // Domain belongs to a verified company — must log in with that account
        setPhase("domain-claimed")
        return
      }

      // Unclaimed or claimable domain — check if user is logged in
      if (!user) {
        setPhase("awaiting-auth")
        wasWaitingForAuth.current = true
        openLoginModal()
        return
      }

      // Store claimable company ID if applicable
      const claimId = result.status === "claimable" ? result.companyId : null
      if (claimId) setClaimableCompanyId(claimId)

      // User is logged in — check if they have a company
      advanceAfterAuth(claimId)
    })
  }, [pendingUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  // Step 2: Watch for auth changes (user logs in while we're waiting)
  useEffect(() => {
    if (wasWaitingForAuth.current && user && phase === "awaiting-auth") {
      wasWaitingForAuth.current = false
      advanceAfterAuth(claimableCompanyId)
    }
  }, [user, phase, claimableCompanyId]) // eslint-disable-line react-hooks/exhaustive-deps

  const advanceAfterAuth = useCallback(async (claimId?: string | null) => {
    if (!user) return

    // Check if user has a company via professionals table
    const { data: proData } = await supabase
      .from("professionals")
      .select("id, company_id")
      .eq("user_id", user.id)
      .maybeSingle()

    if (!proData?.company_id) {
      if (!urlDomain) return
      // No company — auto-create or claim from URL domain
      setPhase("creating-company")
      const result = await autoCreateCompanyFromDomain(urlDomain, claimId ?? undefined)
      if (!result.success) {
        toast.error(result.error)
        setPhase("idle")
        onReset()
        return
      }
      setCompanyId(result.companyId)
      setProfessionalId(result.professionalId)
      // Skip domain verification in dev, otherwise verify
      if (process.env.NODE_ENV === "development") {
        setPhase("importing")
      } else {
        setPhase("verifying-domain")
      }
      return
    }

    setCompanyId(proData.company_id)
    setProfessionalId(proData.id)

    // Check if company domain matches the URL domain
    const { data: companyData } = await supabase
      .from("companies")
      .select("domain, is_verified")
      .eq("id", proData.company_id)
      .maybeSingle()

    const storedDomain = companyData?.domain
      ? companyData.domain.replace(/^https?:\/\//i, "").split("/")[0].replace(/^www\./, "").toLowerCase()
      : null

    setCompanyDomain(storedDomain)
    setIsVerified(Boolean(companyData?.is_verified))

    if (storedDomain && storedDomain === urlDomain && companyData?.is_verified) {
      // Domain matches and is verified — go to import
      setPhase("importing")
      return
    }

    // TODO: Remove this bypass after testing — skip domain verification temporarily
    if (process.env.NODE_ENV === "development") {
      setPhase("importing")
      return
    }

    // Need domain verification
    setPhase("verifying-domain")
  }, [user, supabase, urlDomain, onReset])

  const handleSendVerificationCode = useCallback(async () => {
    if (!urlDomain || !verifyEmail) return
    setVerifyError(null)
    setIsVerifying(true)
    const result = await sendDomainVerificationAction({
      domain: urlDomain,
      email: verifyEmail,
      companyName: "",
    })
    if (result.success) {
      setVerifyCodeSent(true)
      toast.success("Verification code sent")
    } else {
      setVerifyError(result.error ?? "Failed to send code.")
    }
    setIsVerifying(false)
  }, [urlDomain, verifyEmail])

  const handleVerifyCode = useCallback(async () => {
    if (!urlDomain || !verifyCode || !companyId) return
    setVerifyError(null)
    setIsVerifying(true)
    const result = await verifyDomainCodeAction({ domain: urlDomain, code: verifyCode })
    if (result.verified) {
      // Update company domain and mark as verified
      await supabase
        .from("companies")
        .update({ domain: urlDomain, is_verified: true } as never)
        .eq("id", companyId)
      toast.success("Domain verified")
      setPhase("importing")
    } else {
      setVerifyError(result.error ?? "Invalid or expired code.")
    }
    setIsVerifying(false)
  }, [urlDomain, verifyCode, companyId, supabase])

  const handleClose = useCallback(() => {
    setPhase("idle")
    setDomainResult(null)
    setCompanyId(null)
    setProfessionalId(null)
    setCompanyDomain(null)
    setIsVerified(false)
    setClaimableCompanyId(null)
    setVerifyEmail("")
    setVerifyCode("")
    setVerifyCodeSent(false)
    setVerifyError(null)
    wasWaitingForAuth.current = false
    onReset()
  }, [onReset])

  // Domain claimed modal
  if (phase === "domain-claimed" && domainResult?.status === "claimed") {
    return (
      <div className="popup-overlay" onClick={handleClose}>
        <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
          <div className="popup-header">
            <h3 className="arco-section-title">Domain already registered</h3>
            <button type="button" className="popup-close" onClick={handleClose} aria-label="Close">✕</button>
          </div>
          <p className="arco-body-text" style={{ marginBottom: 24 }}>
            This domain belongs to <strong>{domainResult.companyName}</strong>. Log in with your company account to import projects from this website.
          </p>
          <div className="popup-actions">
            <button className="btn-tertiary" onClick={handleClose} style={{ flex: 1 }}>Cancel</button>
            <button
              className="btn-primary"
              onClick={() => {
                handleClose()
                openLoginModal()
              }}
              style={{ flex: 1 }}
            >
              Log in
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Creating company spinner
  if (phase === "creating-company") {
    return (
      <div className="popup-overlay">
        <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380, textAlign: "center" }}>
          <p className="arco-body-text" style={{ margin: "16px 0" }}>Setting up your company...</p>
        </div>
      </div>
    )
  }

  // Checking domain spinner
  if (phase === "checking-domain") {
    return (
      <div className="popup-overlay">
        <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380, textAlign: "center" }}>
          <p className="arco-body-text" style={{ margin: "16px 0" }}>Checking domain...</p>
        </div>
      </div>
    )
  }

  // Domain verification modal
  if (phase === "verifying-domain") {
    return (
      <div className="popup-overlay" onClick={handleClose}>
        <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
          <div className="popup-header">
            <h3 className="arco-section-title">Verify domain</h3>
            <button type="button" className="popup-close" onClick={handleClose} aria-label="Close">✕</button>
          </div>
          <p style={{ fontSize: 13, fontWeight: 300, color: "var(--arco-light)", margin: "0 0 20px" }}>
            Verify ownership of <strong>{urlDomain}</strong> by entering a code sent to your company email.
          </p>

          {verifyError && (
            <div className="popup-banner popup-banner--danger" style={{ marginBottom: 16 }}>
              <AlertTriangle className="popup-banner-icon" />
              <span>{verifyError}</span>
            </div>
          )}

          {!verifyCodeSent ? (
            <>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 400, color: "var(--arco-black)" }}>
                Company email
              </label>
              <input
                type="email"
                autoFocus
                value={verifyEmail}
                onChange={(e) => setVerifyEmail(e.target.value)}
                placeholder={`yourname@${urlDomain}`}
                className="w-full px-3 py-2 text-sm border border-border rounded-[3px] mb-4 focus:outline-none focus:border-foreground"
                onKeyDown={(e) => { if (e.key === "Enter") handleSendVerificationCode() }}
              />
              <div className="popup-actions">
                <button className="btn-tertiary" onClick={handleClose} style={{ flex: 1 }}>Cancel</button>
                <button
                  className="btn-primary"
                  disabled={isVerifying || !verifyEmail.includes("@")}
                  onClick={handleSendVerificationCode}
                  style={{ flex: 1 }}
                >
                  {isVerifying ? "Sending..." : "Send code"}
                </button>
              </div>
            </>
          ) : (
            <>
              <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 400, color: "var(--arco-black)" }}>
                Enter the 6-digit code sent to {verifyEmail}
              </label>
              <input
                type="text"
                autoFocus
                inputMode="numeric"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="w-full px-3 py-2 text-sm border border-border rounded-[3px] mb-2 focus:outline-none focus:border-foreground tracking-widest text-center"
                style={{ fontSize: 18, letterSpacing: "0.3em" }}
                onKeyDown={(e) => { if (e.key === "Enter" && verifyCode.length === 6) handleVerifyCode() }}
              />
              <button
                type="button"
                onClick={handleSendVerificationCode}
                style={{ fontSize: 12, fontWeight: 300, color: "var(--arco-accent)", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 16 }}
              >
                Resend code
              </button>
              <div className="popup-actions">
                <button className="btn-tertiary" onClick={handleClose} style={{ flex: 1 }}>Cancel</button>
                <button
                  className="btn-primary"
                  disabled={isVerifying || verifyCode.length !== 6}
                  onClick={handleVerifyCode}
                  style={{ flex: 1 }}
                >
                  {isVerifying ? "Verifying..." : "Verify"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // Import modal (all prerequisites met)
  if (phase === "importing") {
    return (
      <ImportProjectModal
        open={true}
        onOpenChange={(open) => { if (!open) handleClose() }}
        userId={user?.id ?? null}
        companyId={companyId}
        professionalId={professionalId}
        initialUrl={pendingUrl ?? undefined}
        onSuccess={(projectId) => {
          // Redirect to company edit page — after setup, user goes to project edit
          router.push(`/dashboard/company?company_id=${companyId}&imported=1&project_id=${projectId}`)
        }}
      />
    )
  }

  // Other phases (awaiting-auth) render nothing — the LoginModal handles its own UI
  return null
}
