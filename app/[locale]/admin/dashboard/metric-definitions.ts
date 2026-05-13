// Metric definitions for the Growth lifecycle model
// Each metric has a title, definition, source, and sub-metrics

export type MetricSource = "supabase" | "posthog"

export type SubMetricDef = {
  key: string
  label: string
  definition: string
  source: MetricSource
}

export type MetricDef = {
  key: string
  title: string
  definition: string
  source: MetricSource
  driver: "acquisition" | "retention" | "monetization" | "churn"
  user: "professional" | "client" | "both"
  supabaseTable?: string
  supabaseFilter?: Record<string, any>
  posthogEvent?: string
  posthogProperties?: Array<{ key: string; operator: string; value: string; type: string }>
  subs: SubMetricDef[]
}

export const METRIC_DEFS: Record<string, MetricDef> = {
  // ── Clients ──────────────────────────────────────────────────────────
  client_visitors: {
    key: "client_visitors",
    title: "Visitors (Clients)",
    definition: "Unique visitors browsing projects and professionals pages. Excludes /businesses, /admin, and /dashboard traffic.",
    source: "posthog",
    driver: "acquisition",
    user: "client",
    posthogEvent: "$pageview",
    posthogProperties: [
      { key: "$current_url", operator: "not_icontains", value: "/businesses", type: "event" },
      { key: "$current_url", operator: "not_icontains", value: "/admin", type: "event" },
      { key: "$current_url", operator: "not_icontains", value: "/dashboard", type: "event" },
    ],
    subs: [
      { key: "direct", label: "Direct", definition: "Typed URL, bookmark, or no referrer", source: "posthog" },
      { key: "google", label: "Organic search", definition: "Google, Bing, DuckDuckGo, Yahoo, Ecosia, Brave, Qwant, Startpage", source: "posthog" },
      { key: "social", label: "Social", definition: "LinkedIn, Facebook, Instagram, X, Pinterest", source: "posthog" },
      { key: "email", label: "Email", definition: "Gmail, Outlook, email clients", source: "posthog" },
      { key: "referral", label: "Referral", definition: "Other websites linking to Arco", source: "posthog" },
    ],
  },
  client_signups: {
    key: "client_signups",
    title: "Signups (Clients)",
    definition: "Users who signed up with a client account type. Counted by profile creation date.",
    source: "supabase",
    driver: "acquisition",
    user: "client",
    supabaseTable: "profiles",
    supabaseFilter: { user_types: "client", not_user_types: "professional" },
    subs: [
      { key: "google", label: "Google", definition: "Signups via Google OAuth", source: "supabase" },
      { key: "email", label: "Email", definition: "Signups via email/OTP", source: "supabase" },
    ],
  },
  client_actives: {
    key: "client_actives",
    title: "Actives (Clients)",
    definition: "Unique visitors browsing the platform.",
    source: "posthog",
    driver: "retention",
    user: "client",
    posthogEvent: "$pageview",
    subs: [],
  },
  sharers: {
    key: "sharers",
    title: "Sharers",
    definition: "Unique clients who shared at least one project or professional via the share modal (link, email, WhatsApp, social).",
    source: "posthog",
    driver: "retention",
    user: "client",
    posthogEvent: "project_shared",
    subs: [
      { key: "shares_per_client", label: "Shares/client", definition: "Average number of shares per unique sharer", source: "posthog" },
      { key: "project_shares", label: "Projects shared", definition: "Total project share actions", source: "posthog" },
      { key: "professional_shares", label: "Professionals shared", definition: "Total professional share actions", source: "posthog" },
    ],
  },
  savers: {
    key: "savers",
    title: "Savers",
    definition: "Unique clients who saved at least one project or professional. Measures active engagement beyond browsing.",
    source: "supabase",
    driver: "retention",
    user: "client",
    supabaseTable: "saved_projects",
    subs: [
      { key: "saves_per_client", label: "Saves per client", definition: "Average number of saves (projects + professionals) per unique saver", source: "supabase" },
    ],
  },
  inquirers: {
    key: "inquirers",
    title: "Inquirers",
    definition: "Clients who clicked to contact a professional (website link, phone number, or email).",
    source: "posthog",
    driver: "retention",
    user: "client",
    posthogEvent: "professional_contacted",
    subs: [
      { key: "contacted", label: "Contacted", definition: "Total contact actions", source: "posthog" },
    ],
  },

  // ── Professionals ────────────────────────────────────────────────────
  pro_visitors: {
    key: "pro_visitors",
    title: "Visitors (Professionals)",
    definition: "Unique visitors to /businesses pages — the landing pages for architect outreach.",
    source: "posthog",
    driver: "acquisition",
    user: "professional",
    posthogEvent: "$pageview",
    posthogProperties: [
      { key: "$current_url", operator: "icontains", value: "/businesses", type: "event" },
    ],
    subs: [
      { key: "apollo", label: "Sales (Apollo)", definition: "Visitors from Apollo email sequences — clicked a link with ?ref= param", source: "posthog" },
      { key: "invites", label: "Professional invites", definition: "Professionals who clicked the invite link in a project invitation email", source: "posthog" },
      { key: "direct", label: "Direct", definition: "Typed URL, bookmark, or no referrer", source: "posthog" },
      { key: "google", label: "Organic search", definition: "Google, Bing, DuckDuckGo, Yahoo, Ecosia, Brave, Qwant, Startpage", source: "posthog" },
      { key: "referral", label: "Referral", definition: "Other websites linking to Arco", source: "posthog" },
    ],
  },
  drafts: {
    key: "drafts",
    title: "Draft",
    definition: "Companies where the domain has been claimed but setup is not yet completed.",
    source: "supabase",
    driver: "acquisition",
    user: "professional",
    supabaseTable: "companies",
    supabaseFilter: { status: "draft" },
    subs: [],
  },
  actives: {
    key: "actives",
    title: "Listed",
    definition: "Companies with status 'listed' — their company page is live and visible to clients.",
    source: "supabase",
    driver: "retention",
    user: "professional",
    supabaseTable: "companies",
    supabaseFilter: { status: "listed" },
    subs: [
      { key: "unlisted", label: "Unlisted", definition: "Companies not yet visible to clients", source: "supabase" },
      { key: "companies", label: "Total companies", definition: "All companies regardless of status", source: "supabase" },
      { key: "ranked_companies", label: "Ranked companies", definition: "% of companies created in the period whose page is ranked (≥1 GSC impression in 28d)", source: "supabase" },
    ],
  },
  responders: {
    key: "responders",
    title: "Responders",
    definition: "Professionals who responded to a client inquiry or lead. Not yet tracked.",
    source: "posthog",
    driver: "retention",
    user: "professional",
    posthogEvent: "lead_responded",
    subs: [
      { key: "replies", label: "Replies", definition: "Total lead responses", source: "posthog" },
    ],
  },
  publishers: {
    key: "publishers",
    title: "Publishers",
    definition: "Projects with status 'published' — live on the platform and visible to everyone.",
    source: "supabase",
    driver: "retention",
    user: "professional",
    supabaseTable: "projects",
    supabaseFilter: { status: "published" },
    subs: [
      { key: "projects", label: "Total projects", definition: "All projects regardless of status", source: "supabase" },
      { key: "ranked_projects", label: "Ranked projects", definition: "% of projects created in the period that are ranked (≥1 GSC impression in 28d)", source: "supabase" },
    ],
  },
  inviters: {
    key: "inviters",
    title: "Inviters",
    definition: "Professionals invited/tagged on projects by other professionals.",
    source: "supabase",
    driver: "retention",
    user: "professional",
    supabaseTable: "project_professionals",
    subs: [
      { key: "pros_invited", label: "Pros invited", definition: "Total professional invitations", source: "supabase" },
    ],
  },
  trials: {
    key: "trials",
    title: "Trials",
    definition: "Professionals who started a trial subscription. Not yet tracked.",
    source: "supabase",
    driver: "retention",
    user: "professional",
    subs: [
      { key: "started", label: "Started", definition: "Trial starts", source: "supabase" },
    ],
  },
  subscribers: {
    key: "subscribers",
    title: "Subscribers",
    definition: "Companies with an active paid subscription (plan_tier is set).",
    source: "supabase",
    driver: "monetization",
    user: "professional",
    supabaseTable: "companies",
    supabaseFilter: { has_plan: true },
    subs: [
      { key: "mrr", label: "MRR", definition: "Monthly recurring revenue", source: "supabase" },
    ],
  },
  // renewals / expansions / contractions removed — these will return as
  // supporting metrics on the Subscribers card once subscription billing
  // is wired. They were placeholder definitions with no real data.
  churn: {
    key: "churn",
    title: "Churn",
    definition: "Subscriptions that were cancelled or expired. Not yet tracked.",
    source: "supabase",
    driver: "churn",
    user: "professional",
    subs: [
      { key: "lost", label: "Lost", definition: "Churned subscriptions", source: "supabase" },
    ],
  },
}
