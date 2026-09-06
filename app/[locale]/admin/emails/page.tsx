"use client"

import { Fragment, Suspense, useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { fetchRecentEmails, fetchTemplateStats, fetchCachedStats, fetchProspectFunnelCounts, sendTestEmail, type ProspectFunnelCounts, type ResendEmail, type TemplateStats } from "./actions"
import { useAuth } from "@/contexts/auth-context"
import { AdminTabs, useAdminTab } from "@/components/admin/admin-tabs"
import { clickedRateColor, deliveredRateColor, openedRateColor } from "@/lib/email-rate-colors"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type UserAudience = "all" | "professional" | "client" | "admin"

type EmailSender = {
  name: string
  email: string
  icon?: string // URL or initials fallback
}

type EmailTemplate = {
  id: string
  name: string
  type: "transactional" | "marketing"
  audience: UserAudience
  description: string
  trigger: string
  subject: string
  sends: number
  deliveryRate: number
  active: boolean
  drip?: string  // group key for drip sequences
  dripDay?: number  // day number in the drip
  from?: EmailSender
}

const SENDERS: Record<string, EmailSender> = {
  arco: { name: "Arco", email: "automated@arcolist.com", icon: "/arco-logo-square.png" },
  niek: { name: "Niek van Leeuwen", email: "niek@arcolist.com", icon: "/arco-logo-square.png" },
  team: { name: "Arco Team", email: "team@arcolist.com", icon: "/arco-logo-square.png" },
}

const AUDIENCE_CONFIG: Record<UserAudience, { label: string; cls: string }> = {
  all: { label: "All", cls: "bg-[#f5f5f4] text-[#6b6b68]" },
  professional: { label: "Professional", cls: "bg-[#e6f4f5] text-[#016D75]" },
  client: { label: "Client", cls: "bg-amber-50 text-amber-700" },
  admin: { label: "Admin", cls: "bg-violet-50 text-violet-700" },
}

const INITIAL_TEMPLATES: EmailTemplate[] = [
  { id: "magic-link", name: "Sign-in Code", type: "transactional", audience: "all", description: "OTP code for magic link sign-in", trigger: "User signs in with email (OTP)", subject: "[Code] is your Arco sign-in code", sends: 0, deliveryRate: 100, active: true, from: SENDERS.arco },
  { id: "signup", name: "Signup Confirmation", type: "transactional", audience: "all", description: "Email confirmation for an unconfirmed account", trigger: "Password sign-in on an unconfirmed account (resend)", subject: "[Code] is your Arco verification code", sends: 0, deliveryRate: 100, active: true, from: SENDERS.arco },
  { id: "domain-verification", name: "Domain Verification", type: "transactional", audience: "professional", description: "6-digit code for domain ownership", trigger: "User verifies company domain during creation", subject: "[Code] is your Arco domain verification code", sends: 0, deliveryRate: 100, active: true, from: SENDERS.arco },
  { id: "professional-invite", name: "Professional Invite", type: "transactional", audience: "professional", description: "Credited on a project", trigger: "Architect credits professional on published project", subject: "[Company] credited you on [Project]", sends: 0, deliveryRate: 100, active: true, from: SENDERS.arco },
  { id: "team-invite", name: "Team Invite", type: "transactional", audience: "professional", description: "Invited to join a company", trigger: "Company admin invites team member", subject: "You're invited to join [Company]", sends: 0, deliveryRate: 100, active: true, from: SENDERS.arco },
  { id: "project-live", name: "Project Live", type: "transactional", audience: "professional", description: "Project published on Arco", trigger: "Admin publishes project (status → published)", subject: "[Project] is now live on Arco", sends: 0, deliveryRate: 100, active: true, from: SENDERS.arco },
  { id: "project-rejected", name: "Project Rejected", type: "transactional", audience: "professional", description: "Project not approved", trigger: "Admin rejects project (status → rejected)", subject: "Update on [Project]", sends: 0, deliveryRate: 100, active: true, from: SENDERS.arco },
  { id: "password-reset", name: "Password Reset", type: "transactional", audience: "all", description: "Reset password link", trigger: "User requests password reset", subject: "Reset your Arco password", sends: 0, deliveryRate: 100, active: true, from: SENDERS.arco },
  { id: "welcome-homeowner", name: "Welcome", type: "marketing", audience: "client", description: "Sent immediately after homeowner signup", trigger: "Profile created with client user type", subject: "Welcome to Arco", sends: 0, deliveryRate: 100, active: true, drip: "homeowner-onboarding", dripDay: 0, from: SENDERS.arco },
  { id: "discover-projects", name: "Discover Projects", type: "marketing", audience: "client", description: "Highlights project browsing and filtering", trigger: "Drip queue · 3 days after signup", subject: "Discover projects on Arco", sends: 0, deliveryRate: 100, active: true, drip: "homeowner-onboarding", dripDay: 3, from: SENDERS.arco },
  { id: "find-professionals", name: "Find Professionals", type: "marketing", audience: "client", description: "Introduces professional discovery", trigger: "Drip queue · 10 days after signup", subject: "Find the right professional on Arco", sends: 0, deliveryRate: 100, active: true, drip: "homeowner-onboarding", dripDay: 10, from: SENDERS.arco },
  { id: "project-digest", name: "Project Digest", type: "marketing", audience: "client", description: "Weekly digest of new projects", trigger: "Not built", subject: "New projects on Arco this week", sends: 0, deliveryRate: 0, active: false, from: SENDERS.arco },
  { id: "inactive-reminder", name: "Inactive Reminder", type: "marketing", audience: "professional", description: "Re-engagement for inactive users", trigger: "Not built", subject: "Your company page on Arco", sends: 0, deliveryRate: 0, active: false, from: SENDERS.arco },
  // Showcase — we built a company + project page, recipient claims.
  { id: "prospect-intro", name: "Showcase Intro", type: "marketing", audience: "professional", description: "Outreach to companies we created a page + project for", trigger: "Admin sends from Companies table (status: Prospected)", subject: "Een podium voor [Company]", sends: 0, deliveryRate: 100, active: true, drip: "showcase", dripDay: 0, from: SENDERS.niek },
  { id: "prospect-followup", name: "Showcase Follow-up", type: "marketing", audience: "professional", description: "Follow-up if no response to Showcase intro", trigger: "Drip queue · 3 days after intro", subject: "[Company] op Arco", sends: 0, deliveryRate: 100, active: true, drip: "showcase", dripDay: 3, from: SENDERS.niek },
  { id: "prospect-final", name: "Showcase Final", type: "marketing", audience: "professional", description: "Last reminder before Showcase sequence ends", trigger: "Drip queue · 7 days after intro", subject: "Claim [Company] op Arco", sends: 0, deliveryRate: 100, active: true, drip: "showcase", dripDay: 7, from: SENDERS.niek },
  // Invite — peer-to-peer when a project owner credits an unclaimed company.
  { id: "new-professional-invite", name: "Invite Intro", type: "marketing", audience: "professional", description: "First contact when an unclaimed company is credited on a project", trigger: "Project owner credits an unclaimed company on a published project", subject: "[Inviter] credited you on [Project]", sends: 0, deliveryRate: 100, active: true, drip: "invite", dripDay: 0, from: SENDERS.arco },
  { id: "new-professional-followup", name: "Invite Follow-up", type: "marketing", audience: "professional", description: "Follow-up if no response to Invite intro", trigger: "Drip queue · 3 days after invite", subject: "Claim [Company]", sends: 0, deliveryRate: 100, active: true, drip: "invite", dripDay: 3, from: SENDERS.arco },
  { id: "new-professional-final", name: "Invite Final", type: "marketing", audience: "professional", description: "Last reminder before Invite sequence ends", trigger: "Drip queue · 7 days after invite", subject: "Last reminder: claim [Company] on Arco", sends: 0, deliveryRate: 100, active: true, drip: "invite", dripDay: 7, from: SENDERS.arco },
  // Outreach — cold outbound, formerly run via Apollo.
  { id: "outreach-intro", name: "Outreach Intro", type: "marketing", audience: "professional", description: "Cold outreach to companies with no Arco page yet", trigger: "Admin enrols Outreach contacts from /admin/sales", subject: "Een podium voor [Company]", sends: 0, deliveryRate: 100, active: true, drip: "outreach", dripDay: 0, from: SENDERS.niek },
  { id: "outreach-followup", name: "Outreach Follow-up", type: "marketing", audience: "professional", description: "Follow-up if no response to Outreach intro", trigger: "Drip queue · 3 days after intro", subject: "[Company] op Arco", sends: 0, deliveryRate: 100, active: true, drip: "outreach", dripDay: 3, from: SENDERS.niek },
  { id: "outreach-final", name: "Outreach Final", type: "marketing", audience: "professional", description: "Last reminder before Outreach sequence ends", trigger: "Drip queue · 10 days after intro", subject: "Maak [Company] aan op Arco", sends: 0, deliveryRate: 100, active: true, drip: "outreach", dripDay: 10, from: SENDERS.niek },
]

const TAB_KEYS = ["funnel", "transactional", "marketing", "sent"] as const
type TabKey = (typeof TAB_KEYS)[number]
// All templates are now previewable

// ——— Funnel tab configuration ————————————————————————————————————
// The lifecycle view: each prospect-funnel stage owns the mails that
// work on it. Three row kinds per lane:
//   - transactional markers: they own the transition moment (day 0 is
//     theirs — funnel mails schedule after them), locked, no toggle;
//   - live sequences: the existing drip templates, channel-chipped;
//   - ghost rows: planned but unbuilt, so the tab doubles as roadmap.
type LaneGhost = { name: string; timing: string; condition?: string; audience?: string }
type FunnelLane = {
  key: keyof ProspectFunnelCounts
  label: string
  dot: string
  driver: "prospect" | "acquisition" | "retention"
  meaning: string
  stop: string
  transactional: Array<{ templateId: string; note: string }>
  sequences: Array<{ channel: string; templateIds: string[] }>
  ghosts: LaneGhost[]
}

const FUNNEL_LANES: FunnelLane[] = [
  {
    key: "contacted",
    label: "Contacted",
    dot: "#f59e0b",
    driver: "prospect",
    meaning: "Intro ontvangen — max 3 mails per kanaal",
    stop: "Stopt bij: promotie, reply, bounce, complaint, unsubscribe",
    transactional: [],
    sequences: [
      { channel: "Invite", templateIds: ["new-professional-invite", "new-professional-followup", "new-professional-final"] },
      { channel: "Showcase", templateIds: ["prospect-intro", "prospect-followup", "prospect-final"] },
      { channel: "Outreach", templateIds: ["outreach-intro", "outreach-followup", "outreach-final"] },
    ],
    ghosts: [],
  },
  {
    key: "visitor",
    label: "Visitor",
    dot: "#2563eb",
    driver: "acquisition",
    meaning: "Funnel geopend, niet geclaimd",
    stop: "Stopt bij: promotie naar Verified",
    transactional: [],
    sequences: [],
    ghosts: [
      { name: "Visitor-nudge", timing: "+3 dagen na bezoek", condition: "Copy als gewone follow-up — de Visitor-stempel kan ook een mailscanner zijn", audience: "All" },
    ],
  },
  {
    key: "verified",
    label: "Verified",
    dot: "#2563eb",
    driver: "acquisition",
    meaning: "Stap 1 bevestigd — nog geen account",
    stop: "Stopt bij: promotie naar Owned",
    transactional: [
      { templateId: "domain-verification", note: "Zit ín stap 1 (platformkanaal) — code vóórdat het bedrijf bevestigd wordt" },
    ],
    sequences: [],
    ghosts: [
      { name: "Verified-reminder", timing: "+1 dag", condition: "Winkelwagen-verlating: token nog 14 dagen geldig, funnel onthoudt de stap", audience: "All" },
    ],
  },
  {
    key: "owned",
    label: "Owned",
    dot: "#2563eb",
    driver: "acquisition",
    meaning: "Account gekoppeld — pagina nog niet live",
    stop: "Stopt bij: promotie naar Listed",
    transactional: [
      { templateId: "magic-link", note: "Alleen bij een afwijkend e-mailadres in stap 2" },
    ],
    sequences: [],
    ghosts: [
      { name: "Publiceer je eerste project", timing: "+2 dagen", audience: "Publisher" },
      { name: "Zo kom je op projecten te staan", timing: "+2 dagen", audience: "Contributor" },
    ],
  },
  {
    key: "active",
    label: "Listed",
    dot: "#7c3aed",
    driver: "retention",
    meaning: "Live met project of credit",
    stop: "Einde ladder — daarna alleen transactioneel",
    transactional: [
      { templateId: "project-live", note: "Bezit het moment — krijgt het 'voeg professionals toe'-blok" },
    ],
    sequences: [],
    ghosts: [
      { name: "Credit je team", timing: "+7 dagen", condition: "Alleen als het project dan nog < 3 credits heeft", audience: "Publisher" },
      { name: "Nodig je opdrachtgevers uit", timing: "+7 dagen", audience: "Contributor" },
    ],
  },
]

// useAdminTab reads useSearchParams, which requires a Suspense boundary
// above it for prerender — hence the thin default-export wrapper.
export default function AdminEmailsPageWrapper() {
  return (
    <Suspense fallback={null}>
      <AdminEmailsPage />
    </Suspense>
  )
}

function AdminEmailsPage() {
  const { user } = useAuth()
  const [emails, setEmails] = useState<ResendEmail[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Tab lives in the URL (?tab=…) so refresh, back and shared links keep
  // the view; "funnel" is the clean-URL default.
  const activeTab = useAdminTab(TAB_KEYS, "funnel")
  const [funnelCounts, setFunnelCounts] = useState<ProspectFunnelCounts | null>(null)
  const [collapsedLanes, setCollapsedLanes] = useState<Set<string>>(new Set())
  const [showStageGuide, setShowStageGuide] = useState(false)

  const toggleLane = (key: string) => {
    setCollapsedLanes((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Sends across everything a lane owns (transactional markers included),
  // within the active time window. The rail shows MAIL activity per stage
  // — prospect inventory already lives on the Sales page — so a lane
  // without mails reads as "0 verstuurd": the coverage gap is the story.
  const laneSends = (lane: FunnelLane) =>
    [...lane.transactional.map((x) => x.templateId), ...lane.sequences.flatMap((s) => s.templateIds)]
      .reduce((n, id) => n + (templateStats[id]?.sends ?? 0), 0)

  useEffect(() => {
    fetchProspectFunnelCounts().then(({ counts, error }) => {
      if (!error) setFunnelCounts(counts)
    })
  }, [])
  const [templates, setTemplates] = useState(INITIAL_TEMPLATES)
  const [templateStats, setTemplateStats] = useState<Record<string, TemplateStats>>({})
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null)
  // Preview locale — toggles the iframe URL so we can eyeball both Dutch
  // and English rendering without restarting the dev server. Reset to EN
  // whenever the preview popup opens on a different template.
  const [previewLocale, setPreviewLocale] = useState<"en" | "nl">("en")
  // Subject for the currently previewed template+locale. Fetched from
  // /admin/emails/preview?meta=1 so it always matches what the renderer
  // would actually send (e.g. "Welkom bij Arco" for the NL welcome).
  const [previewSubject, setPreviewSubject] = useState<string | null>(null)

  // Re-fetch whenever the previewed template or the locale toggle changes.
  useEffect(() => {
    if (!previewTemplate) {
      setPreviewSubject(null)
      return
    }
    let cancelled = false
    setPreviewSubject(null)
    fetch(`/admin/emails/preview?template=${previewTemplate}&lang=${previewLocale}&meta=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json?.subject) setPreviewSubject(json.subject)
      })
      .catch(() => { /* non-fatal — header just shows template name */ })
    return () => { cancelled = true }
  }, [previewTemplate, previewLocale])
  const [audienceFilter, setAudienceFilter] = useState<UserAudience | "all-filter">("all-filter")
  const [timeFilter, setTimeFilter] = useState<string>("30d")
  const [isPending, startTransition] = useTransition()

  // On mount: load cached stats instantly so the table renders with data
  // before the slower Resend API fetch completes.
  const [statsLoaded, setStatsLoaded] = useState(false)
  useEffect(() => {
    fetchCachedStats().then(({ stats }) => {
      if (Object.keys(stats).length > 0) {
        setTemplateStats(stats)
        setStatsLoaded(true)
      }
    })
  }, [])

  useEffect(() => {
    const sinceDate = timeFilter === "all" ? undefined
      : timeFilter === "7d" ? new Date(Date.now() - 7 * 86400000).toISOString()
      : timeFilter === "30d" ? new Date(Date.now() - 30 * 86400000).toISOString()
      : timeFilter === "90d" ? new Date(Date.now() - 90 * 86400000).toISOString()
      : undefined
    if (!statsLoaded) setIsLoading(true)
    Promise.all([fetchRecentEmails(), fetchTemplateStats(sinceDate)]).then(([emailResult, statsResult]) => {
      if (emailResult.error) setError(emailResult.error)
      else setEmails(emailResult.emails)
      // Merge fresh stats on top of cached — keeps cached values for
      // templates the fresh fetch didn't return (e.g. no sends in the
      // selected time window).
      if (statsResult.stats && Object.keys(statsResult.stats).length > 0) {
        setTemplateStats(prev => ({ ...prev, ...statsResult.stats }))
      }
      setIsLoading(false)
      setStatsLoaded(true)
    })
  }, [timeFilter])

  const handleSendTest = (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user?.email) { toast.error("No email address found"); return }
    startTransition(async () => {
      const result = await sendTestEmail(templateId, user.email!)
      if (result.success) toast.success(`Test email sent to ${user.email}`)
      else toast.error(result.error ?? "Failed to send test email")
    })
  }

  const toggleActive = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, active: !t.active } : t))
    const t = templates.find(t => t.id === id)
    toast.success(`${t?.name} ${t?.active ? "deactivated" : "activated"}`)
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    } catch { return dateStr }
  }

  const filteredTemplates = templates
    .filter(t => t.type === activeTab)
    .filter(t => audienceFilter === "all-filter" || t.audience === audienceFilter)
  const activeCount = templates.filter(t => t.type === activeTab && t.active).length
  const totalCount = templates.filter(t => t.type === activeTab).length

  // Group drip sequences: first email is the header, rest are collapsed
  const [expandedDrips, setExpandedDrips] = useState<Set<string>>(new Set())
  const groupedTemplates = (() => {
    const result: Array<{ template: EmailTemplate; isDripHeader: boolean; dripCount: number; dripChildren: EmailTemplate[] }> = []
    const seenDrips = new Set<string>()

    for (const t of filteredTemplates) {
      if (t.drip) {
        if (seenDrips.has(t.drip)) continue // skip non-first drip items
        seenDrips.add(t.drip)
        const dripItems = filteredTemplates.filter(x => x.drip === t.drip).sort((a, b) => (a.dripDay ?? 0) - (b.dripDay ?? 0))
        result.push({ template: dripItems[0], isDripHeader: true, dripCount: dripItems.length, dripChildren: dripItems.slice(1) })
      } else {
        result.push({ template: t, isDripHeader: false, dripCount: 0, dripChildren: [] })
      }
    }
    return result
  })()

  const STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
    sent: { label: "Sent", dot: "#016D75" },
    delivered: { label: "Delivered", dot: "#059669" },
    opened: { label: "Opened", dot: "#2563eb" },
    clicked: { label: "Clicked", dot: "#7c3aed" },
    bounced: { label: "Bounced", dot: "#dc2626" },
    complained: { label: "Spam", dot: "#dc2626" },
    unsubscribed: { label: "Unsubscribed", dot: "#dc2626" },
  }

  return (
    <div className="min-h-screen bg-white">

      {/* Tabs — URL-backed second nav in a sticky bar (project sub-nav
          pattern); the page-level filters ride in the actions slot so
          they stay reachable while the bar is pinned. */}
      <AdminTabs
        title="Emails"
        tabs={[
          { key: "funnel", label: "Funnel" },
          { key: "transactional", label: "Transactional" },
          { key: "marketing", label: "Marketing" },
          { key: "sent", label: "Sent" },
        ]}
        active={activeTab}
        actions={
          activeTab !== "sent" ? (
            <>
              {(activeTab === "transactional" || activeTab === "marketing") && (
                <Select
                  value={audienceFilter}
                  onValueChange={(value) => setAudienceFilter(value as UserAudience | "all-filter")}
                >
                  <SelectTrigger className="w-[170px] h-9 text-xs border-[#e5e5e4] rounded-[3px]">
                    <SelectValue placeholder="All audiences" />
                  </SelectTrigger>
                  {/* Above the sticky bar's z-100, or the menu's top edge
                      slides underneath it and looks detached. */}
                  <SelectContent className="z-[120]">
                    <SelectItem value="all-filter">All audiences</SelectItem>
                    <SelectItem value="all">All users</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Select value={timeFilter} onValueChange={setTimeFilter}>
                <SelectTrigger className="w-[140px] h-9 text-xs border-[#e5e5e4] rounded-[3px]">
                  <SelectValue placeholder="All time" />
                </SelectTrigger>
                <SelectContent className="z-[120]">
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </>
          ) : undefined
        }
      />

      {/* Status guide — floats in the gap under the sticky bar, same
          treatment as the tour-replay link on company edit. */}
      <div className="wrap" style={{ position: "relative", height: 0 }}>
      {activeTab === "funnel" && (
          <button
          type="button"
          onClick={() => setShowStageGuide(true)}
          className="arco-text-link arco-text-link--primary absolute right-5 md:right-[60px]"
          style={{ top: 12, fontSize: 12 }}
          >
            Status guide
          </button>
      )}
      </div>

      <div className="wrap" style={{ paddingTop: 52, paddingBottom: 48 }}>

        {/* Page meta — the funnel tab carries no counter (the rail's
            per-stage sends tell the story); the list tabs keep theirs. */}
        {activeTab !== "funnel" && (
          <div className="discover-results-meta" style={{ marginBottom: 16 }}>
            <p className="discover-results-count">
              {activeTab === "sent" ? (
                <><strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>{emails.length}</strong> emails</>
              ) : (
                <><strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>{totalCount}</strong> total · {activeCount} active</>
              )}
            </p>
          </div>
        )}

          {/* Funnel — stage rail + swimlanes */}
          {activeTab === "funnel" && (() => {
            const byId = new Map(templates.map(t => [t.id, t]))
            const stageKeys = FUNNEL_LANES.map(l => l.key)
            // Cohort math mirrors the Sales funnel: "reached this stage
            // or beyond", so the connector rates survive people moving
            // through quickly.
            const cohorted = stageKeys.map((_, i) =>
              stageKeys.slice(i).reduce((sum, k) => sum + (funnelCounts?.[k] ?? 0), 0)
            )
            const statCells = (id: string) => {
              const s = templateStats[id]
              const sends = s?.sends ?? 0
              const deliveryRate = sends > 0 ? Math.round((s.delivered / sends) * 100) : 0
              const openRate = sends > 0 ? Math.round((s.opened / sends) * 100) : 0
              const clickRate = sends > 0 ? Math.round((s.clicked / sends) * 100) : 0
              const unsubs = s?.unsubscribed ?? 0
              return (
                <>
                  <td style={{ textAlign: "right" }} className="text-xs text-[#6b6b68] font-medium">{sends > 0 ? sends.toLocaleString() : "—"}</td>
                  <td style={{ textAlign: "right" }} className="text-xs font-medium"><span className={deliveredRateColor(deliveryRate, sends)}>{sends > 0 ? `${deliveryRate}%` : "—"}</span></td>
                  <td style={{ textAlign: "right" }} className="text-xs font-medium"><span className={openedRateColor(openRate, sends)}>{sends > 0 ? `${openRate}%` : "—"}</span></td>
                  <td style={{ textAlign: "right" }} className="text-xs font-medium"><span className={clickedRateColor(clickRate, sends)}>{sends > 0 ? `${clickRate}%` : "—"}</span></td>
                  {/* One decimal below 1% — 1 unsub of 300 would otherwise
                      round to 0% and vanish, and that one is the signal. */}
                  <td style={{ textAlign: "right" }} className={`text-xs font-medium ${unsubs > 0 ? "text-red-600" : "text-[#c4c4c2]"}`}>
                    {sends > 0
                      ? `${(unsubs / sends) * 100 < 1 && unsubs > 0 ? (((unsubs / sends) * 100).toFixed(1)) : Math.round((unsubs / sends) * 100)}%`
                      : "—"}
                  </td>
                </>
              )
            }
            return (
              <div>
                {/* Rail — colors and driver eyebrows mirror the Sales funnel */}
                <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
                  <div style={{ display: "grid", gridTemplateColumns: FUNNEL_LANES.map((_, i) => i === 0 ? "auto" : "1fr auto").join(" "), gap: 0, alignItems: "start" }}>
                    {FUNNEL_LANES.map((lane, i) => {
                      const sends = laneSends(lane)
                      const rate = i > 0 && cohorted[i - 1] > 0 ? `${Math.round((cohorted[i] / cohorted[i - 1]) * 100)}%` : ""
                      const DRIVER_COLORS: Record<string, string> = { prospect: "#f59e0b", acquisition: "#2563eb", retention: "#7c3aed" }
                      const isDriverStart = i === 0 || FUNNEL_LANES[i - 1].driver !== lane.driver
                      return (
                        <Fragment key={lane.key}>
                          {i > 0 && (
                            <div className="relative px-1 self-center" style={{ minWidth: 32 }}>
                              <div className="w-full border-t border-[#d4d4d3]" />
                              {rate && (
                                <span className="absolute text-[10px] font-medium text-[#6b6b68]" style={{ top: -16, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap" }}>{rate}</span>
                              )}
                            </div>
                          )}
                          <div className="flex flex-col">
                          {isDriverStart ? (
                            <p className="arco-eyebrow mb-2" style={{ color: DRIVER_COLORS[lane.driver] }}>{lane.driver.charAt(0).toUpperCase() + lane.driver.slice(1)}</p>
                          ) : (
                            <div style={{ height: 24 }} />
                          )}
                          <button
                            onClick={() => {
                              // A collapsed lane unfolds before the rail scrolls to it.
                              setCollapsedLanes((prev) => {
                                if (!prev.has(lane.key)) return prev
                                const next = new Set(prev)
                                next.delete(lane.key)
                                return next
                              })
                              requestAnimationFrame(() => {
                                document.getElementById(`funnel-lane-${lane.key}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
                              })
                            }}
                            className="rounded-[3px] border border-[#e5e5e4] bg-white px-3 py-3 text-left transition-colors hover:border-[#c4c4c2]"
                            style={{ width: 132 }}
                          >
                            <div className="flex items-center gap-[6px] mb-1.5">
                              <span className="status-pill-dot shrink-0" style={{ background: lane.dot }} />
                              <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 400, color: "var(--text-primary)" }}>{lane.label}</span>
                            </div>
                            <p className="arco-card-title text-left">{statsLoaded ? sends.toLocaleString() : "…"}</p>
                            <p className="text-[10px] text-[#a1a1a0] text-left" style={{ marginTop: 2 }}>verstuurd</p>
                          </button>
                          </div>
                        </Fragment>
                      )
                    })}
                  </div>
                </div>

                {/* Swimlanes */}
                {FUNNEL_LANES.map((lane) => {
                  const isCollapsed = collapsedLanes.has(lane.key)
                  const mailCount = lane.transactional.length + lane.sequences.reduce((n, s) => n + s.templateIds.length, 0)
                  return (
                  <div key={lane.key} id={`funnel-lane-${lane.key}`} className="mt-8" style={{ scrollMarginTop: 140 }}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => toggleLane(lane.key)}
                        className="flex items-center gap-2 min-w-0"
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" className={`shrink-0 transition-transform ${isCollapsed ? "" : "rotate-90"}`}>
                          <path d="M3 2L7 5L3 8" stroke="#a1a1a0" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                        </svg>
                        <span className="status-pill-dot shrink-0" style={{ background: lane.dot }} />
                        <span className="text-sm font-medium text-[#1c1c1a]">{lane.label}</span>
                        <span className="text-xs text-[#a1a1a0]">{laneSends(lane).toLocaleString()} verstuurd</span>
                        {isCollapsed && (
                          <span className="text-xs text-[#a1a1a0] shrink-0">
                            · {mailCount} mails{lane.ghosts.length > 0 ? ` · ${lane.ghosts.length} nog te bouwen` : ""}
                          </span>
                        )}
                      </button>
                    </div>
                    {!isCollapsed && (
                    <div className="arco-table-wrap" style={{ maxWidth: "100%", marginTop: 10 }}>
                      {/* table-layout: fixed + one shared colgroup — every
                          lane is its own <table>, and auto layout would size
                          columns per lane's content, so Audience/Subject
                          would sit at a different x in each lane. Fixed
                          geometry lines all five lanes up. */}
                      <table className="arco-table" style={{ minWidth: 850, width: "100%", tableLayout: "fixed" }}>
                        <colgroup>
                          <col />
                          <col style={{ width: 110 }} />
                          <col style={{ width: 270 }} />
                          <col style={{ width: 80 }} />
                          <col style={{ width: 90 }} />
                          <col style={{ width: 80 }} />
                          <col style={{ width: 80 }} />
                          <col style={{ width: 80 }} />
                          <col style={{ width: 70 }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th>Email</th>
                            <th>Audience</th>
                            <th>Subject</th>
                            <th style={{ textAlign: "right" }}>Sends</th>
                            <th style={{ textAlign: "right" }}>Delivered</th>
                            <th style={{ textAlign: "right" }}>Opened</th>
                            <th style={{ textAlign: "right" }}>Clicked</th>
                            <th style={{ textAlign: "right" }}>Unsubs</th>
                            <th style={{ textAlign: "center" }}>Active</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lane.transactional.map(({ templateId, note }) => {
                            const t = byId.get(templateId)
                            if (!t) return null
                            return (
                              <tr key={templateId} style={{ cursor: "pointer" }} onClick={() => setPreviewTemplate(templateId)}>
                                <td>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="arco-table-primary">{t.name}</span>
                                      <span className="status-pill">Transactioneel</span>
                                    </div>
                                    <div className="arco-table-secondary" style={{ marginTop: 2 }}>{note}</div>
                                  </div>
                                </td>
                                <td className="text-xs text-[#c4c4c2]">—</td>
                                <td style={{ maxWidth: 250 }} className="text-xs text-[#6b6b68] truncate">{t.subject}</td>
                                {statCells(templateId)}
                                {/* Transactional stays locked: a receipt-class mail
                                    can't be switched off from the funnel view. */}
                                <td style={{ textAlign: "center" }} className="text-xs text-[#c4c4c2]">—</td>
                              </tr>
                            )
                          })}
                          {lane.sequences.map((seq) =>
                            seq.templateIds.map((id, idx) => {
                              const t = byId.get(id)
                              if (!t) return null
                              return (
                                <tr key={id} style={{ cursor: "pointer" }} onClick={() => setPreviewTemplate(id)}>
                                  <td>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="arco-table-primary">{t.name}</span>
                                        {t.dripDay !== undefined && (
                                          <span className="status-pill" style={{ borderColor: "#bfdbfe", color: "#2563eb" }}>Day {t.dripDay}</span>
                                        )}
                                      </div>
                                      <div className="arco-table-secondary" style={{ marginTop: 2 }}>{t.trigger}</div>
                                    </div>
                                  </td>
                                  <td className="text-xs text-[#6b6b68]">{seq.channel}</td>
                                  <td style={{ maxWidth: 250 }} className="text-xs text-[#6b6b68] truncate">{t.subject}</td>
                                  {statCells(id)}
                                  <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                                    <button
                                      onClick={(e) => toggleActive(id, e)}
                                      className="relative inline-block"
                                      style={{ width: 34, height: 18, borderRadius: 9, border: "none", cursor: "pointer", background: t.active ? "#016D75" : "#d4d4d4", transition: "background .2s" }}
                                    >
                                      <span style={{
                                        position: "absolute", top: 2, left: t.active ? 18 : 2,
                                        width: 14, height: 14, borderRadius: 7, background: "#fff",
                                        transition: "left .2s", boxShadow: "0 1px 2px rgba(0,0,0,.15)",
                                      }} />
                                    </button>
                                  </td>
                                </tr>
                              )
                            })
                          )}
                          {lane.ghosts.map((g) => (
                            <tr key={g.name} style={{ background: "var(--arco-white)" }}>
                              <td>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="arco-table-primary" style={{ color: "#a1a1a0" }}>{g.name}</span>
                                    <span className="status-pill" style={{ borderColor: "#e5e5e4", color: "#a1a1a0" }}>{g.timing}</span>
                                    <span className="status-pill" style={{ borderStyle: "dashed", color: "#a1a1a0" }}>Nog te bouwen</span>
                                  </div>
                                  {g.condition && <div className="arco-table-secondary" style={{ marginTop: 2 }}>{g.condition}</div>}
                                </div>
                              </td>
                              <td className="text-xs text-[#a1a1a0]">{g.audience ?? "—"}</td>
                              <td className="text-xs text-[#c4c4c2]">—</td>
                              <td style={{ textAlign: "right" }} className="text-xs text-[#c4c4c2]">—</td>
                              <td style={{ textAlign: "right" }} className="text-xs text-[#c4c4c2]">—</td>
                              <td style={{ textAlign: "right" }} className="text-xs text-[#c4c4c2]">—</td>
                              <td style={{ textAlign: "right" }} className="text-xs text-[#c4c4c2]">—</td>
                              <td style={{ textAlign: "right" }} className="text-xs text-[#c4c4c2]">—</td>
                              <td style={{ textAlign: "center" }} className="text-xs text-[#c4c4c2]">—</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    )}
                  </div>
                  )
                })}
              </div>
            )
          })()}

          {/* Transactional / Marketing table */}
          {(activeTab === "transactional" || activeTab === "marketing") && (
            <>
            <div className="arco-table-wrap" style={{ maxWidth: "100%", marginTop: 16 }}>
              <table className="arco-table" style={{ minWidth: 600 }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: 220 }}>Email</th>
                    <th>From</th>
                    <th>User</th>
                    <th>Subject</th>
                    <th style={{ textAlign: "right" }}>Sends</th>
                    <th style={{ textAlign: "right" }}>Delivered</th>
                    <th style={{ textAlign: "right" }} title="Enable tracking in Resend dashboard">Opened</th>
                    <th style={{ textAlign: "right" }} title="Enable tracking in Resend dashboard">Clicked</th>
                    <th style={{ textAlign: "center" }}>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedTemplates.map(({ template: t, isDripHeader, dripCount, dripChildren }) => (
                    <Fragment key={t.id}>
                    <tr
                      style={{ cursor: "pointer" }}
                      onClick={() => setPreviewTemplate(t.id)}
                    >
                      <td>
                        <div className="flex items-center gap-2">
                          {isDripHeader && (
                            <button
                              className="shrink-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                setExpandedDrips((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(t.drip!)) next.delete(t.drip!)
                                  else next.add(t.drip!)
                                  return next
                                })
                              }}
                            >
                              <svg width="10" height="10" viewBox="0 0 10 10" className={`transition-transform ${expandedDrips.has(t.drip!) ? "rotate-90" : ""}`}>
                                <path d="M3 2L7 5L3 8" stroke="#a1a1a0" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                              </svg>
                            </button>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="arco-table-primary">{t.name}</span>
                              {isDripHeader && (
                                <span className="status-pill">{dripCount} emails</span>
                              )}
                              {t.dripDay !== undefined && (
                                <span className="status-pill" style={{ borderColor: "#bfdbfe", color: "#2563eb" }}>Day {t.dripDay}</span>
                              )}
                            </div>
                            <div className="arco-table-secondary" style={{ marginTop: 2 }}>{t.trigger}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {t.from ? (
                          <div className="flex items-center gap-2">
                            {t.from.icon ? (
                              <div className="arco-table-avatar" style={{ width: 20, height: 20 }}>
                                <img src={t.from.icon} alt="" />
                              </div>
                            ) : (
                              <div className="arco-table-avatar" style={{ width: 20, height: 20, background: "#f5f5f4", color: "#6b6b68", fontSize: 9 }}>
                                {t.from.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
                              </div>
                            )}
                            <div className="flex flex-col min-w-0">
                              <span className="arco-table-primary">{t.from.name}</span>
                              <span className="arco-table-secondary" style={{ marginTop: 1 }}>{t.from.email}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="arco-table-secondary" style={{ marginTop: 0 }}>—</span>
                        )}
                      </td>
                      <td>
                        {AUDIENCE_CONFIG[t.audience].label}
                      </td>
                      <td style={{ maxWidth: 250 }} className="text-xs text-[#6b6b68] truncate">
                        {t.subject}
                      </td>
                      {(() => {
                        const s = templateStats[t.id]
                        const sends = s?.sends ?? 0
                        const deliveryRate = sends > 0 ? Math.round((s.delivered / sends) * 100) : 0
                        const openRate = sends > 0 ? Math.round((s.opened / sends) * 100) : 0
                        const clickRate = sends > 0 ? Math.round((s.clicked / sends) * 100) : 0
                        return <>
                      <td style={{ textAlign: "right" }} className="text-xs text-[#6b6b68] font-medium">
                        {sends > 0 ? sends.toLocaleString() : "—"}
                      </td>
                      <td style={{ textAlign: "right" }} className="text-xs font-medium">
                        <span className={deliveredRateColor(deliveryRate, sends)}>
                          {sends > 0 ? `${deliveryRate}%` : "—"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }} className="text-xs font-medium">
                        <span className={openedRateColor(openRate, sends)}>
                          {sends > 0 ? `${openRate}%` : "—"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }} className="text-xs font-medium">
                        <span className={clickedRateColor(clickRate, sends)}>
                          {sends > 0 ? `${clickRate}%` : "—"}
                        </span>
                      </td>
                        </>
                      })()}
                      <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                        <button
                          onClick={(e) => toggleActive(t.id, e)}
                          className="relative inline-block"
                          style={{ width: 34, height: 18, borderRadius: 9, border: "none", cursor: "pointer", background: t.active ? "#016D75" : "#d4d4d4", transition: "background .2s" }}
                        >
                          <span style={{
                            position: "absolute", top: 2, left: t.active ? 18 : 2,
                            width: 14, height: 14, borderRadius: 7, background: "#fff",
                            transition: "left .2s", boxShadow: "0 1px 2px rgba(0,0,0,.15)",
                          }} />
                        </button>
                      </td>
                    </tr>
                    {/* Drip children — shown when expanded */}
                    {isDripHeader && expandedDrips.has(t.drip!) && dripChildren.map((child) => (
                      <tr
                        key={child.id}
                        style={{ cursor: "pointer", background: "var(--arco-white)" }}
                        onClick={() => setPreviewTemplate(child.id)}
                      >
                        <td style={{ paddingLeft: 40 }}>
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="arco-table-primary">{child.name}</span>
                                {child.dripDay !== undefined && (
                                  <span className="status-pill" style={{ borderColor: "#bfdbfe", color: "#2563eb" }}>Day {child.dripDay}</span>
                                )}
                              </div>
                              <div className="arco-table-secondary" style={{ marginTop: 2 }}>{child.trigger}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          {child.from ? (
                            <div className="flex items-center gap-2">
                              {child.from.icon ? (
                                <div className="arco-table-avatar" style={{ width: 20, height: 20 }}>
                                  <img src={child.from.icon} alt="" />
                                </div>
                              ) : (
                                <div className="arco-table-avatar" style={{ width: 20, height: 20, background: "#f5f5f4", color: "#6b6b68", fontSize: 9 }}>
                                  {child.from.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
                                </div>
                              )}
                              <div className="flex flex-col min-w-0">
                                <span className="arco-table-primary">{child.from.name}</span>
                                <span className="arco-table-secondary" style={{ marginTop: 1 }}>{child.from.email}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="arco-table-secondary" style={{ marginTop: 0 }}>—</span>
                          )}
                        </td>
                        <td>
                          {AUDIENCE_CONFIG[child.audience].label}
                        </td>
                        <td style={{ maxWidth: 250 }} className="text-xs text-[#6b6b68] truncate">{child.subject}</td>
                        {(() => {
                          const s = templateStats[child.id]
                          const sends = s?.sends ?? 0
                          const deliveryRate = sends > 0 ? Math.round((s.delivered / sends) * 100) : 0
                          const openRate = sends > 0 ? Math.round((s.opened / sends) * 100) : 0
                          const clickRate = sends > 0 ? Math.round((s.clicked / sends) * 100) : 0
                          return <>
                            <td style={{ textAlign: "right" }} className="text-xs text-[#6b6b68] font-medium">{sends > 0 ? sends.toLocaleString() : "—"}</td>
                            <td style={{ textAlign: "right" }} className="text-xs font-medium"><span className={deliveredRateColor(deliveryRate, sends)}>{sends > 0 ? `${deliveryRate}%` : "—"}</span></td>
                            <td style={{ textAlign: "right" }} className="text-xs font-medium"><span className={openedRateColor(openRate, sends)}>{sends > 0 ? `${openRate}%` : "—"}</span></td>
                            <td style={{ textAlign: "right" }} className="text-xs font-medium"><span className={clickedRateColor(clickRate, sends)}>{sends > 0 ? `${clickRate}%` : "—"}</span></td>
                          </>
                        })()}
                        <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                          <button
                            onClick={(e) => toggleActive(child.id, e)}
                            className="relative inline-block"
                            style={{ width: 34, height: 18, borderRadius: 9, border: "none", cursor: "pointer", background: child.active ? "#016D75" : "#d4d4d4", transition: "background .2s" }}
                          >
                            <span style={{
                              position: "absolute", top: 2, left: child.active ? 18 : 2,
                              width: 14, height: 14, borderRadius: 7, background: "#fff",
                              transition: "left .2s", boxShadow: "0 1px 2px rgba(0,0,0,.15)",
                            }} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}

          {/* Sent emails table */}
          {activeTab === "sent" && (
            <div className="arco-table-wrap" style={{ maxWidth: "100%", marginTop: 16 }}>
              {isLoading ? (
                <p className="text-sm text-[#a1a1a0] text-center py-10">Loading sent emails...</p>
              ) : error ? (
                <p className="text-sm text-red-600 text-center py-10">{error}</p>
              ) : emails.length === 0 ? (
                <p className="text-sm text-[#a1a1a0] text-center py-10">No emails sent yet.</p>
              ) : (
                <table className="arco-table" style={{ minWidth: 600 }}>
                  <thead>
                    <tr>
                      <th>To</th>
                      <th style={{ minWidth: 220 }}>Email</th>
                      <th>Subject</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Sent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emails.map((email) => {
                      const status = STATUS_CONFIG[email.last_event] ?? { label: email.last_event, dot: "#a1a1a0" }
                      return (
                        <tr key={email.id}>
                          <td className="text-sm text-[#1c1c1a]">{email.to.join(", ")}</td>
                          <td className="text-xs text-[#6b6b68]">
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                              {email.templateId ? (
                                <button
                                  type="button"
                                  className="text-[#016D75] hover:underline cursor-pointer"
                                  onClick={() => setPreviewTemplate(email.templateId)}
                                >
                                  {email.templateName}
                                </button>
                              ) : (
                                <span className="text-[#c4c4c2] italic">Unknown</span>
                              )}
                              {email.locale && (
                                <span
                                  className="status-pill"
                                  title={email.locale === "nl" ? "Dutch" : "English"}
                                  style={{ textTransform: "uppercase" }}
                                >
                                  {email.locale}
                                </span>
                              )}
                            </span>
                          </td>
                          <td style={{ maxWidth: 300 }} className="text-sm text-[#1c1c1a] truncate">{email.subject}</td>
                          <td>
                            <span className="arco-table-status">
                              <span className="arco-table-status-dot" style={{ background: status.dot }} />
                              {status.label}
                            </span>
                          </td>
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }} className="text-xs text-[#a1a1a0]">{formatDate(email.created_at)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Stage guide popup — same pattern as the Companies/Sales status guides */}
          {showStageGuide && (
            <div className="popup-overlay" onClick={() => setShowStageGuide(false)}>
              <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: "85vh", overflowY: "auto" }}>
                <div className="popup-header">
                  <h3 className="arco-section-title">Funnel stages</h3>
                  <button type="button" className="popup-close" onClick={() => setShowStageGuide(false)} aria-label="Close">✕</button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {FUNNEL_LANES.map((lane) => (
                    <div key={lane.key} style={{ display: "flex", gap: 12 }}>
                      <span className="shrink-0" style={{ width: 8, height: 8, borderRadius: "50%", marginTop: 5, background: lane.dot }} />
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "#1c1c1a" }}>{lane.label}</p>
                        <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b6b68", lineHeight: 1.4 }}>{lane.meaning}</p>
                        <p style={{ margin: "4px 0 0", fontSize: 11, color: "#a1a1a0", lineHeight: 1.3 }}>{lane.stop}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 20, padding: "12px 16px", background: "#f5f5f4", borderRadius: 4, fontSize: 11, color: "#6b6b68", lineHeight: 1.5 }}>
                  <strong>Flow:</strong> Contacted → Visitor → Verified → Owned → Listed — elke stage bezit de mails die eraan werken.
                  <br />
                  <strong>Transactioneel bezit dag 0:</strong> bij een stage-overgang verstuurt alleen de transactionele bevestiging; funnel-mails plannen op +N dagen en zijn conditioneel (ze slaan over wie de actie al deed).
                  <br />
                  <strong>Stop-bij-promotie:</strong> elke stage-overgang stopt de sequence van de vorige stage, gecheckt op verzendmoment.
                </div>

                <div className="flex justify-end mt-6">
                  <button
                    onClick={() => setShowStageGuide(false)}
                    className="h-9 px-4 text-xs font-medium border border-[#e5e5e4] rounded-[3px] text-[#6b6b68] hover:bg-[#fafaf9] transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Preview popup */}
          {previewTemplate && (
            <div className="popup-overlay" onClick={() => setPreviewTemplate(null)}>
              <div
                className="popup-card"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: 640, padding: 0, maxHeight: "85vh", display: "flex", flexDirection: "column" }}
              >
                <div style={{
                  padding: "16px 24px", background: "var(--arco-off-white)",
                  borderRadius: "12px 12px 0 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
                }}>
                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <span className="text-sm font-medium text-[#1c1c1a]">
                      {templates.find(t => t.id === previewTemplate)?.name}
                    </span>
                    {previewSubject && (
                      <span
                        className="text-xs text-[#6b6b68] truncate"
                        style={{ marginTop: 2 }}
                        title={previewSubject}
                      >
                        {previewSubject}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {/* Locale toggle — affects only the iframe render.
                        Test send still uses the resolver. */}
                    <div style={{ display: "inline-flex", border: "1px solid var(--arco-rule)", borderRadius: 3, overflow: "hidden", fontSize: 11 }}>
                      {(["en", "nl"] as const).map((loc) => (
                        <button
                          key={loc}
                          type="button"
                          onClick={() => setPreviewLocale(loc)}
                          style={{
                            padding: "4px 10px",
                            background: previewLocale === loc ? "var(--arco-black)" : "transparent",
                            color: previewLocale === loc ? "#fff" : "var(--arco-mid-grey)",
                            border: "none",
                            cursor: "pointer",
                            fontWeight: previewLocale === loc ? 500 : 400,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          {loc}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={(e) => handleSendTest(previewTemplate, e)}
                      disabled={isPending}
                      className="arco-nav-text h-7 px-3 rounded-[3px] text-xs"
                      style={{ background: "var(--primary)", color: "#fff", border: "none", cursor: "pointer", opacity: isPending ? 0.5 : 1 }}
                    >
                      {isPending ? "Sending..." : "Send test"}
                    </button>
                    <button className="popup-close" onClick={() => setPreviewTemplate(null)} aria-label="Close">✕</button>
                  </div>
                </div>
                <iframe
                  src={`/admin/emails/preview?template=${previewTemplate}&lang=${previewLocale}`}
                  style={{ width: "100%", flex: 1, minHeight: 500, border: "none", background: "#f5f5f4" }}
                  title="Email preview"
                />
              </div>
            </div>
          )}

      </div>
    </div>
  )
}
