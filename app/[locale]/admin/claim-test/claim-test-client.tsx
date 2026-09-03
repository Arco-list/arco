"use client"

import { useMemo, useState } from "react"

import type { ClaimChannel } from "@/lib/claim/claim-token"

import { mintClaimTestLinkAction, resetClaimFixtureAction } from "./actions"

type Row = {
  id: string
  name: string
  email: string | null
  domain: string | null
  status: string
  pendingCredits: number
}

const CHANNELS: ClaimChannel[] = ["invite", "showcase", "outreach"]
const FIXTURE_ID = "c0c0c629-2983-4658-b834-c5dafe6bc7f3" // Olli

export function ClaimTestClient({ companies }: { companies: Row[] }) {
  const [q, setQ] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [result, setResult] = useState<{ url: string; email: string; channel: string; name: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resetMsg, setResetMsg] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const base = needle
      ? companies.filter((c) => c.name.toLowerCase().includes(needle) || (c.domain ?? "").includes(needle))
      : companies
    // Fixture bovenaan, dan bedrijven met een pending credit.
    return [...base].sort((a, b) =>
      Number(b.id === FIXTURE_ID) - Number(a.id === FIXTURE_ID)
      || Number(b.pendingCredits > 0) - Number(a.pendingCredits > 0)
      || a.name.localeCompare(b.name),
    ).slice(0, 40)
  }, [companies, q])

  async function mint(c: Row, channel: ClaimChannel) {
    setBusy(`${c.id}:${channel}`); setError(null); setResult(null)
    const res = await mintClaimTestLinkAction({ companyId: c.id, channel })
    setBusy(null)
    if (!res.ok) { setError(`${c.name} · ${channel}: ${res.error}`); return }
    // Local origin, zodat de link direct op deze omgeving werkt.
    const url = `${window.location.origin}/nl/claim?t=${encodeURIComponent(res.token)}`
    setResult({ url, email: res.email, channel, name: c.name })
    try { await navigator.clipboard.writeText(url) } catch { /* clipboard optional */ }
  }

  async function resetFixture() {
    setBusy("reset"); setResetMsg(null); setError(null)
    const res = await resetClaimFixtureAction()
    setBusy(null)
    if (!res.ok) { setError(res.error); return }
    setResetMsg(res.summary)
  }

  return (
    <div style={{ maxWidth: 980 }}>
      <h1 className="arco-section-title" style={{ marginBottom: 6 }}>Claim-funnel testen</h1>
      <p className="arco-body-text" style={{ maxWidth: "62ch", marginBottom: 8 }}>
        Tokens zijn single-use: elke doorloop begint met een verse link. Kies een bedrijf en een
        kanaal — de link komt op je klembord. Invite vereist een openstaande credit op een
        gepubliceerd project; showcase/outreach gebruiken companies.email.
      </p>
      <p className="arco-small-text" style={{ marginBottom: 8 }}>
        Na een voltooide commit op <strong>Olli</strong> (de fixture): reset hieronder — verwijdert de
        testaccounts (@askolli.com), zet de credit terug naar invited en het bedrijf naar unclaimed.
      </p>
      <p className="arco-small-text" style={{ marginBottom: 24 }}>
        De <strong>platform</strong>-funnel is tokenloos: open{" "}
        <a href="/nl/claim" target="_blank" rel="noopener noreferrer" className="arco-text-link arco-text-link--primary">/nl/claim</a>{" "}
        zonder token voor de zoek-instap.
      </p>

      {result && (
        <div style={{ border: "1px solid var(--primary)", background: "var(--arco-wash)", borderRadius: 3, padding: "14px 16px", marginBottom: 16 }}>
          <div className="arco-small-text" style={{ marginBottom: 6 }}>
            <strong>{result.name}</strong> · {result.channel} · {result.email} — gekopieerd naar klembord
          </div>
          <a href={result.url} target="_blank" rel="noopener noreferrer" className="arco-text-link arco-text-link--primary" style={{ overflowWrap: "anywhere", fontSize: 13 }}>
            {result.url}
          </a>
        </div>
      )}
      {error && <p className="arco-small-text" style={{ color: "var(--destructive)", marginBottom: 16 }}>{error}</p>}
      {resetMsg && <p className="arco-small-text" style={{ color: "var(--primary)", marginBottom: 16 }}>Fixture gereset: {resetMsg}</p>}

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <input
          className="form-input"
          style={{ maxWidth: 320, marginBottom: 0 }}
          placeholder="Zoek bedrijf of domein…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="button" className="btn-tertiary-outline" disabled={busy === "reset"} onClick={resetFixture}>
          {busy === "reset" ? "Bezig…" : "Reset Olli-fixture"}
        </button>
      </div>

      <div className="arco-table-wrap">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--arco-light)" }}>
              <th style={{ padding: "8px 10px", fontWeight: 500 }}>Bedrijf</th>
              <th style={{ padding: "8px 10px", fontWeight: 500 }}>Status</th>
              <th style={{ padding: "8px 10px", fontWeight: 500 }}>E-mail</th>
              <th style={{ padding: "8px 10px", fontWeight: 500 }}>Credits</th>
              <th style={{ padding: "8px 10px", fontWeight: 500 }}>Testlink</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} style={{ borderTop: "1px solid var(--arco-rule)", background: c.id === FIXTURE_ID ? "var(--arco-wash)" : undefined }}>
                <td style={{ padding: "10px" }}>
                  {c.name}{c.id === FIXTURE_ID ? " · fixture" : ""}
                  <span style={{ display: "block", color: "var(--arco-light)", fontSize: 12 }}>{c.domain ?? "—"}</span>
                </td>
                <td style={{ padding: "10px", color: "var(--arco-mid)" }}>{c.status}</td>
                <td style={{ padding: "10px", color: "var(--arco-mid)" }}>{c.email ?? "—"}</td>
                <td style={{ padding: "10px" }}>{c.pendingCredits > 0 ? <span className="filter-pill-badge">{c.pendingCredits}</span> : "—"}</td>
                <td style={{ padding: "10px" }}>
                  <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {CHANNELS.map((ch) => {
                      const disabled = busy !== null || (ch === "invite" && c.pendingCredits === 0) || (ch !== "invite" && !c.email)
                      return (
                        <button key={ch} type="button" className="btn-tertiary-outline"
                          style={{ padding: "5px 12px", fontSize: 12, opacity: disabled ? 0.4 : 1 }}
                          disabled={disabled}
                          onClick={() => mint(c, ch)}>
                          {busy === `${c.id}:${ch}` ? "…" : ch}
                        </button>
                      )
                    })}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
