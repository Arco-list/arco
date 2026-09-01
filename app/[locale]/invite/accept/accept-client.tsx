"use client"

import { useState } from "react"
import Link from "next/link"
import { CheckCircle2 } from "lucide-react"

import type { AcceptOutcome, CreditPreview } from "@/lib/invites/accept-credit"

import { acceptCreditAction } from "./actions"

/**
 * The acceptance step. The emailed link lands here already knowing which
 * credit it is about — the seven steps it replaces were all about FINDING
 * that credit, not about deciding.
 */
export function AcceptClient({
  token,
  preview,
  locale,
  copy,
}: {
  token: string
  preview: CreditPreview
  locale: string
  copy: Record<string, string>
}) {
  const [outcome, setOutcome] = useState<AcceptOutcome | null>(null)
  const [busy, setBusy] = useState(false)

  const projectHref = preview.projectSlug ? `/${locale}/projects/${preview.projectSlug}` : null

  const submit = async () => {
    setBusy(true)
    const result = await acceptCreditAction(token)
    setBusy(false)
    setOutcome(result)
  }

  if (outcome?.status === "accepted" || outcome?.status === "already_accepted" || preview.alreadyAccepted) {
    const slug = outcome && "projectSlug" in outcome ? outcome.projectSlug : preview.projectSlug
    return (
      <div className="arco-banner arco-banner--highlight" style={{ marginTop: 28 }}>
        <div style={{ minWidth: 0 }}>
          <p className="arco-banner-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <CheckCircle2 size={22} style={{ color: "var(--primary-ink)" }} />
            {copy.acceptedTitle}
          </p>
          <p className="arco-banner-body">{copy.acceptedBody}</p>
        </div>
        <div className="arco-banner-actions">
          {slug && (
            <Link href={`/${locale}/projects/${slug}`} className="btn-tertiary btn-tertiary-accent">
              {copy.viewProject}
            </Link>
          )}
        </div>
      </div>
    )
  }

  if (outcome?.status === "needs_signin") {
    return (
      <Notice
        title={copy.signinTitle}
        body={copy.signinBody}
        action={<Link href={`/${locale}/login`} className="btn-tertiary btn-tertiary-accent">{copy.signin}</Link>}
      />
    )
  }

  if (outcome?.status === "wrong_account") {
    return <Notice title={copy.wrongAccountTitle} body={copy.wrongAccountBody} />
  }

  if (outcome?.status === "invalid") {
    return <Notice title={copy.invalidTitle} body={copy.invalidBody} />
  }

  return (
    <div style={{ marginTop: 28, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 18 }}>
      <button type="button" className="btn-primary" onClick={submit} disabled={busy}>
        {busy ? copy.accepting : copy.accept}
      </button>
      {projectHref && (
        <Link href={projectHref} className="arco-banner-dismiss">{copy.viewProject}</Link>
      )}
    </div>
  )
}

function Notice({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="arco-banner" style={{ marginTop: 28 }}>
      <div style={{ minWidth: 0 }}>
        <p className="arco-banner-title">{title}</p>
        <p className="arco-banner-body">{body}</p>
      </div>
      {action && <div className="arco-banner-actions">{action}</div>}
    </div>
  )
}
