"use client"

type EventDef = {
  event: string
  function: string
  stage: string
  driver: "acquisition" | "retention" | "monetization"
  user: "professional" | "client" | "both"
  source: "posthog" | "platform"
  wired: boolean
  description: string
}

const EVENTS: EventDef[] = [
  // Acquisition
  { event: "page_viewed", function: "trackPageView(path)", stage: "Visitors", driver: "acquisition", user: "both", source: "posthog", wired: true, description: "Key page loaded (homepage, browse, businesses)" },
  { event: "user_signed_up", function: "trackSignup(userId, method, type)", stage: "Signups", driver: "acquisition", user: "both", source: "posthog", wired: true, description: "User completes signup via email, Google, or Apple" },

  // Retention — Professionals
  { event: "company_created", function: "trackCompanyCreated(id, name)", stage: "Actives", driver: "retention", user: "professional", source: "posthog", wired: true, description: "New company page created" },
  { event: "company_listed", function: "trackCompanyListed(id)", stage: "Actives", driver: "retention", user: "professional", source: "posthog", wired: false, description: "Company page goes live/listed" },
  { event: "project_published", function: "trackProjectPublished(id, title)", stage: "Publishers", driver: "retention", user: "professional", source: "posthog", wired: true, description: "Project status changed to published" },
  { event: "professional_invited", function: "trackProfessionalInvited(projectId, email)", stage: "Inviters", driver: "retention", user: "professional", source: "posthog", wired: true, description: "Professional invited/tagged on a project" },
  { event: "lead_responded", function: "trackLeadResponded(companyId)", stage: "Responders", driver: "retention", user: "professional", source: "posthog", wired: false, description: "Professional responds to a client inquiry" },
  { event: "trial_started", function: "trackTrialStarted(companyId, tier)", stage: "Trials", driver: "retention", user: "professional", source: "posthog", wired: false, description: "Professional starts a trial subscription" },

  // Retention — Clients
  { event: "project_saved", function: "trackProjectSaved(id)", stage: "Savers", driver: "retention", user: "client", source: "posthog", wired: true, description: "Client saves a project to favorites" },
  { event: "project_shared", function: "trackProjectShared(id, method)", stage: "Sharers", driver: "retention", user: "client", source: "posthog", wired: true, description: "Client shares a project via link, email, or social" },
  { event: "professional_contacted", function: "trackProfessionalContacted(id, method)", stage: "Inquirers", driver: "retention", user: "client", source: "posthog", wired: true, description: "Client clicks to contact a professional (website, phone)" },
  { event: "professional_saved", function: "trackProfessionalSaved(id)", stage: "Savers", driver: "retention", user: "client", source: "posthog", wired: true, description: "Client saves a professional to favorites" },

  // Monetization
  { event: "plan_subscribed", function: "trackSubscribed(id, tier)", stage: "Subscribers", driver: "monetization", user: "professional", source: "posthog", wired: false, description: "Professional subscribes to a paid plan" },
  { event: "plan_renewed", function: "trackRenewed(id, tier)", stage: "Renewals", driver: "monetization", user: "professional", source: "posthog", wired: false, description: "Subscription renewed" },
  { event: "plan_expanded", function: "trackExpansion(id, from, to)", stage: "Expansions", driver: "monetization", user: "professional", source: "posthog", wired: false, description: "Plan upgraded to higher tier" },
  { event: "plan_contracted", function: "trackContraction(id, from, to)", stage: "Contractions", driver: "monetization", user: "professional", source: "posthog", wired: false, description: "Plan downgraded to lower tier" },
  { event: "plan_churned", function: "trackChurn(id, reason)", stage: "Churn", driver: "monetization", user: "professional", source: "posthog", wired: false, description: "Subscription cancelled or expired" },

  // Engagement (supporting)
  { event: "project_viewed", function: "trackProjectViewed(id, slug)", stage: "Engagement", driver: "retention", user: "both", source: "posthog", wired: true, description: "Project detail page viewed" },
  { event: "professional_viewed", function: "trackProfessionalViewed(id, slug)", stage: "Engagement", driver: "retention", user: "both", source: "posthog", wired: true, description: "Professional detail page viewed" },
  { event: "search_performed", function: "trackSearch(query, count)", stage: "Engagement", driver: "retention", user: "both", source: "posthog", wired: true, description: "Search query submitted" },
]

const DRIVER_COLORS = {
  acquisition: { dot: "#2563eb", text: "#2563eb" },
  retention: { dot: "#7c3aed", text: "#7c3aed" },
  monetization: { dot: "#0f766e", text: "#0f766e" },
}

export function EventsOverview() {
  const wiredCount = EVENTS.filter((e) => e.wired).length
  const totalCount = EVENTS.length

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="arco-h4">Tracking Events</h3>
          <p className="text-xs text-[#a1a1a0] mt-0.5">
            {wiredCount} of {totalCount} events wired · PostHog autocapture is disabled
          </p>
        </div>
        <a href="/admin/growth" className="text-xs text-[#6b6b68] hover:text-[#1c1c1a] transition-colors">
          ← Back to Growth
        </a>
      </div>

      <div className="border border-[#e5e5e4] rounded-[3px] overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_180px_100px_100px_80px_80px] bg-[#fafaf9] border-b border-[#e5e5e4] px-4 py-2">
          <span className="text-[10px] font-medium text-[#a1a1a0] uppercase tracking-wider">Event</span>
          <span className="text-[10px] font-medium text-[#a1a1a0] uppercase tracking-wider">Function</span>
          <span className="text-[10px] font-medium text-[#a1a1a0] uppercase tracking-wider">Stage</span>
          <span className="text-[10px] font-medium text-[#a1a1a0] uppercase tracking-wider">Driver</span>
          <span className="text-[10px] font-medium text-[#a1a1a0] uppercase tracking-wider">User</span>
          <span className="text-[10px] font-medium text-[#a1a1a0] uppercase tracking-wider">Status</span>
        </div>

        {/* Rows */}
        {EVENTS.map((ev) => {
          const dc = DRIVER_COLORS[ev.driver]
          return (
            <div key={ev.event} className="grid grid-cols-[1fr_180px_100px_100px_80px_80px] px-4 py-2.5 border-b border-[#f0f0ee] hover:bg-[#fafaf9] transition-colors items-center">
              <div>
                <code className="text-[11px] font-medium text-[#1c1c1a]">{ev.event}</code>
                <p className="text-[10px] text-[#a1a1a0] mt-0.5">{ev.description}</p>
              </div>
              <code className="text-[10px] text-[#6b6b68] truncate">{ev.function}</code>
              <span className="text-[11px] text-[#1c1c1a]">{ev.stage}</span>
              <div className="flex items-center gap-1.5">
                <span className="w-[6px] h-[6px] rounded-full" style={{ background: dc.dot }} />
                <span className="text-[11px] capitalize" style={{ color: dc.text }}>{ev.driver}</span>
              </div>
              <span className="text-[11px] text-[#6b6b68] capitalize">{ev.user}</span>
              <span className={`text-[10px] font-medium ${ev.wired ? "text-emerald-600" : "text-[#a1a1a0]"}`}>
                {ev.wired ? "Live" : "Not wired"}
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-6 p-4 border border-[#e5e5e4] rounded-[3px] bg-[#fafaf9]">
        <p className="text-[11px] font-medium text-[#1c1c1a] mb-1">Implementation</p>
        <p className="text-[10px] text-[#a1a1a0] leading-relaxed">
          All events are defined in <code className="bg-white px-1 py-0.5 rounded text-[10px]">lib/tracking.ts</code>.
          Client components import tracking functions directly.
          Server component pages use <code className="bg-white px-1 py-0.5 rounded text-[10px]">components/track-view.tsx</code> wrapper components.
          PostHog autocapture is disabled — only these manual events are sent.
        </p>
      </div>
    </>
  )
}
