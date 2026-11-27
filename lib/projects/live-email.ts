import "server-only"

import { logger } from "@/lib/logger"
import { getSiteUrl } from "@/lib/utils"
import { sendProjectStatusEmail } from "@/lib/email-service"
import { getCompanyEmailRecipients } from "@/lib/companies/company-email-recipients"
import { AUTO_RECOGNIZE_SINCE } from "@/lib/recognition/flags"

/**
 * De "je project staat live"-mail (migratie 361).
 *
 * Goedkeuren zet een project meteen live, maar de mail wacht tot de stippen
 * beoordeeld zijn: de herkenning draait in een batch en een admin ruimt de
 * stippen op, zodat de eigenaar straks alleen de goede stippen ziet
 * ("je project staat live, koppel de producten").
 *
 * Wanneer de mail gaat (releaseHeldLiveEmails, bij elk oordeel van een admin
 * en elke minuut vanuit de cron van photo-detections):
 *   - alle foto's zijn herkend (niets meer in de wachtrij of in een batch), en
 *   - geen stip staat nog open (review_status leeg);
 *   - of de mail wacht al HOLD_MAX_DAYS: dan toch, zodat niemand hem mist.
 */

const HOLD_MAX_DAYS = 7

/**
 * Uit tot de mail zelf is aangepast ("je project staat live, koppel de
 * producten"): tot dan gaat hij meteen bij goedkeuren, zoals vroeger.
 */
export const HOLD_LIVE_EMAIL_FOR_REVIEW = false

type Svc = any

export type ProjectMailContext = {
  project: any
  projectPhoto: { url: string } | null
  projectTypeLabel: string | undefined
  recipients: Array<{ email: string; userId: string | null }>
  firstnameFor: (r: { userId: string | null }) => string
  baseUrl: string
}

/** Project, eerste foto, type en ontvangers: gelijk voor de live- en de afwijsmail. */
export async function projectMailContext(svc: Svc, projectId: string): Promise<ProjectMailContext> {
  const { data: project } = await svc
    .from("projects")
    .select(`
      title,
      slug,
      client_id,
      location,
      address_city,
      building_type,
      project_type,
      project_type_category_id,
      profiles!client_id(first_name, last_name)
    `)
    .eq("id", projectId)
    .single()

  const { data: projectPhoto } = await svc
    .from("project_photos")
    .select("url")
    .eq("project_id", projectId)
    .order("order_index", { ascending: true })
    .limit(1)
    .maybeSingle()

  let projectTypeLabel: string | undefined
  const bt = project?.building_type
  const btIsUuid = bt && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bt)
  if (bt && !btIsUuid) {
    projectTypeLabel = bt.charAt(0).toUpperCase() + bt.slice(1).replace(/-/g, " ")
  }
  if (!projectTypeLabel) {
    const catId = btIsUuid ? bt : project?.project_type_category_id
    if (catId) {
      const { data: cat } = await svc.from("categories").select("name").eq("id", catId).maybeSingle()
      if (cat?.name) projectTypeLabel = cat.name
    }
  }
  if (!projectTypeLabel && project?.project_type) projectTypeLabel = project.project_type

  let ownerEmail: string | null = null
  if (project?.client_id) {
    try {
      const { data: ownerAuth } = await svc.auth.admin.getUserById(project.client_id)
      ownerEmail = ownerAuth?.user?.email || null
    } catch (error) {
      logger.error("Failed to get owner email", { scope: "project-mail", clientId: project.client_id, error: String(error) })
    }
  }

  // Het team van het eigenaarsbedrijf: iedereen met bedrijfsmail aan
  // (teampagina). Zonder bedrijf: alleen de eigenaar.
  const { data: ownerCredit } = await svc
    .from("project_professionals")
    .select("company_id")
    .eq("project_id", projectId)
    .eq("is_project_owner", true)
    .not("company_id", "is", null)
    .maybeSingle()
  let recipients: Array<{ email: string; userId: string | null }> = ownerCredit?.company_id
    ? await getCompanyEmailRecipients(ownerCredit.company_id)
    : []
  if (recipients.length === 0 && ownerEmail) recipients = [{ email: ownerEmail, userId: project?.client_id ?? null }]

  // Elke ontvanger met zijn eigen voornaam, niet die van de eigenaar.
  const firstNameByUserId = new Map<string, string>()
  const ids = recipients.map((r) => r.userId).filter((id): id is string => Boolean(id))
  if (ids.length > 0) {
    const { data: profiles } = await svc.from("profiles").select("id, first_name").in("id", ids)
    for (const p of (profiles ?? []) as Array<{ id: string; first_name: string | null }>) {
      if (p.first_name) firstNameByUserId.set(p.id, p.first_name)
    }
  }
  const firstnameFor = (r: { userId: string | null }) => (r.userId ? firstNameByUserId.get(r.userId) : undefined) ?? ""

  return { project, projectPhoto: projectPhoto ?? null, projectTypeLabel, recipients, firstnameFor, baseUrl: getSiteUrl() }
}

/** De live-mail naar elke ontvanger; het aantal verstuurde mails. */
export async function sendProjectLiveEmail(svc: Svc, projectId: string, ctx?: ProjectMailContext): Promise<number> {
  const { project, projectPhoto, projectTypeLabel, recipients, firstnameFor, baseUrl } = ctx ?? await projectMailContext(svc, projectId)
  if (recipients.length === 0) {
    logger.warn("No owner email found for project live notification", { scope: "project-mail", projectId, clientId: project?.client_id })
    return 0
  }
  for (const recipient of recipients) {
    await sendProjectStatusEmail(
      recipient.email,
      "live",
      {
        firstname: firstnameFor(recipient),
        project_title: project?.title || "Your Project",
        project_name: project?.title || "Your Project",
        project_image: projectPhoto?.url ?? undefined,
        project_location: project?.address_city ?? project?.location ?? undefined,
        project_type: projectTypeLabel,
        project_link: `${baseUrl}/projects/${project?.slug ?? projectId}`,
        dashboard_link: `${baseUrl}/dashboard/listings`,
      },
      { userId: recipient.userId },
    )
  }
  logger.info("Project live email sent", { scope: "project-mail", projectId, recipients: recipients.length })
  return recipients.length
}

/**
 * Bij goedkeuren: wachten op de stippen? Alleen als de herkenning voor dit
 * project draait (live sinds AUTO_RECOGNIZE_SINCE, met foto's). Dan zet dit
 * de mail in de wacht en geeft true; anders false en gaat hij meteen.
 */
export async function holdLiveEmailForReview(svc: Svc, projectId: string): Promise<boolean> {
  if (!HOLD_LIVE_EMAIL_FOR_REVIEW) return false
  const { data: p } = await svc.from("projects").select("published_at").eq("id", projectId).maybeSingle()
  if (!p?.published_at || p.published_at < AUTO_RECOGNIZE_SINCE) return false
  const { count } = await svc.from("project_photos").select("id", { count: "exact", head: true }).eq("project_id", projectId)
  if (!count) return false
  const { error } = await svc.from("projects").update({ live_email_held_at: new Date().toISOString() }).eq("id", projectId)
  if (error) {
    logger.warn("Could not hold project live email — sending now", { scope: "project-mail", projectId, error: error.message })
    return false
  }
  logger.info("Project live email held until the dots are reviewed", { scope: "project-mail", projectId })
  return true
}

/** Klaar met beoordelen: alle foto's herkend en geen stip meer open. */
async function reviewDone(svc: Svc, projectId: string): Promise<boolean> {
  const [{ count: pending }, { count: open }] = await Promise.all([
    svc.from("project_photo_analyses").select("photo_id", { count: "exact", head: true }).eq("project_id", projectId).in("status", ["queued", "submitted"]),
    svc.from("project_photo_detections").select("id", { count: "exact", head: true }).eq("project_id", projectId).is("review_status", null),
  ])
  if (pending || open) return false
  // Nog niet in de wachtrij gezet (de cron heeft het project nog niet
  // opgepikt): nog niet klaar.
  const { count: analysed } = await svc.from("project_photo_analyses").select("photo_id", { count: "exact", head: true }).eq("project_id", projectId)
  return Boolean(analysed)
}

/**
 * Wachtende live-mails versturen die nu mogen (zie boven); met `projectId`
 * alleen dat project. Geeft de projecten waarvoor de mail is verstuurd.
 */
export async function releaseHeldLiveEmails(svc: Svc, projectId?: string): Promise<string[]> {
  let q = svc.from("projects").select("id, status, live_email_held_at").not("live_email_held_at", "is", null).limit(200)
  if (projectId) q = q.eq("id", projectId)
  const { data } = await q
  const sent: string[] = []
  for (const p of (data ?? []) as Array<{ id: string; status: string; live_email_held_at: string }>) {
    const overdue = Date.now() - new Date(p.live_email_held_at).getTime() > HOLD_MAX_DAYS * 86_400_000
    if (p.status === "published" && !overdue && !(await reviewDone(svc, p.id))) continue
    // Claimen: wie de wacht leegmaakt, verstuurt (cron en oordeel kunnen overlappen).
    const { data: claimed } = await svc.from("projects").update({ live_email_held_at: null })
      .eq("id", p.id).eq("live_email_held_at", p.live_email_held_at).select("id")
    if (!claimed?.length) continue
    // Intussen offline gehaald: geen mail.
    if (p.status !== "published") continue
    try {
      await sendProjectLiveEmail(svc, p.id)
      if (overdue) logger.warn("Project live email sent after waiting the maximum for review", { scope: "project-mail", projectId: p.id })
      sent.push(p.id)
    } catch (err) {
      // Niet opnieuw proberen (zoals bij goedkeuren): een half verstuurde
      // ronde zou anders elke minuut dubbele mails geven.
      logger.error("Failed to send held project live email", { scope: "project-mail", projectId: p.id }, err as any)
    }
  }
  return sent
}
