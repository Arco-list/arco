/**
 * PostHog event tracking — manual events only.
 * Autocapture is disabled. Only these events are sent to PostHog.
 *
 * Each event maps to a stage in the Growth lifecycle model.
 */

function capture(event: string, properties?: Record<string, any>) {
  if (typeof window !== "undefined" && (window as any).posthog) {
    ;(window as any).posthog.capture(event, properties)
  }
}

function identify(userId: string, properties?: Record<string, any>) {
  if (typeof window !== "undefined" && (window as any).posthog) {
    ;(window as any).posthog.identify(userId, properties)
  }
}

// ─── Session Recording ───────────────────────────────────────────────────────

/** Start PostHog session recording. Call on high-value actions (company creation, project import). */
export function startSessionRecording() {
  if (typeof window !== "undefined" && (window as any).posthog) {
    ;(window as any).posthog.startSessionRecording()
  }
}

// ─── Acquisition ──────────────────────────────────────────────────────────────

/** Page viewed — replaces autocapture pageview. Call on key pages only. */
export function trackPageView(path: string, properties?: Record<string, any>) {
  capture("page_viewed", { path, ...properties })
}

/** User signed up */
export function trackSignup(userId: string, method: "email" | "google" | "apple", userType: "professional" | "client") {
  identify(userId, { user_type: userType, signup_method: method })
  capture("user_signed_up", { method, user_type: userType })
}

// ─── Retention: Professionals ─────────────────────────────────────────────────

/** Company page created (Active) */
export function trackCompanyCreated(companyId: string, companyName: string) {
  capture("company_created", { company_id: companyId, company_name: companyName })
}

/** Company page listed/published (Active) */
export function trackCompanyListed(companyId: string) {
  capture("company_listed", { company_id: companyId })
}

/** Project published (Publisher) */
export function trackProjectPublished(projectId: string, projectTitle: string) {
  capture("project_published", { project_id: projectId, project_title: projectTitle })
}

/** Professional invited to project (Inviter) */
export function trackProfessionalInvited(projectId: string, invitedEmail: string) {
  capture("professional_invited", { project_id: projectId, invited_email: invitedEmail })
}

/** Responded to a lead/inquiry (Responder) */
export function trackLeadResponded(companyId: string) {
  capture("lead_responded", { company_id: companyId })
}

/** Started a trial (Trial) */
export function trackTrialStarted(companyId: string, planTier: string) {
  capture("trial_started", { company_id: companyId, plan_tier: planTier })
}

// ─── Retention: Clients ───────────────────────────────────────────────────────

/** Saved a project (Saver) */
export function trackProjectSaved(projectId: string) {
  capture("project_saved", { project_id: projectId })
}

/** Shared a project (Sharer) */
/** Shared a project (Sharer) — channel: link, email, whatsapp, messenger, facebook, x, system */
export function trackProjectShared(projectId: string, channel: string) {
  capture("project_shared", { project_id: projectId, channel })
}

/** Shared a professional (Sharer) */
export function trackProfessionalShared(companyId: string, channel: string) {
  capture("professional_shared", { company_id: companyId, channel })
}

/** Contacted a professional (Inquirer) */
export function trackProfessionalContacted(companyId: string, method: "form" | "phone" | "website") {
  capture("professional_contacted", { company_id: companyId, method })
}

/** Saved a professional */
export function trackProfessionalSaved(companyId: string) {
  capture("professional_saved", { company_id: companyId })
}

// ─── Monetization ─────────────────────────────────────────────────────────────

/** Subscribed to a paid plan (Subscriber) */
export function trackSubscribed(companyId: string, planTier: string) {
  capture("plan_subscribed", { company_id: companyId, plan_tier: planTier })
}

/** Renewed subscription (Renewal) */
export function trackRenewed(companyId: string, planTier: string) {
  capture("plan_renewed", { company_id: companyId, plan_tier: planTier })
}

/** Upgraded plan (Expansion) */
export function trackExpansion(companyId: string, fromTier: string, toTier: string) {
  capture("plan_expanded", { company_id: companyId, from_tier: fromTier, to_tier: toTier })
}

/** Downgraded plan (Contraction) */
export function trackContraction(companyId: string, fromTier: string, toTier: string) {
  capture("plan_contracted", { company_id: companyId, from_tier: fromTier, to_tier: toTier })
}

/** Subscription churned */
export function trackChurn(companyId: string, reason?: string) {
  capture("plan_churned", { company_id: companyId, reason })
}

// ─── Engagement (supporting metrics) ──────────────────────────────────────────

/** Search performed */
export function trackSearch(query: string, resultCount: number) {
  capture("search_performed", { query, result_count: resultCount })
}

/** Project viewed */
export function trackProjectViewed(projectId: string, slug: string) {
  capture("project_viewed", { project_id: projectId, slug })
}

/** Professional page viewed */
export function trackProfessionalViewed(companyId: string, slug: string) {
  capture("professional_viewed", { company_id: companyId, slug })
}
