/**
 * The hand-written mails an admin sends from the contact card.
 *
 * THE COMPANY'S STATE PICKS THE MAIL, not a menu. A firm whose page is
 * already live cannot be asked to claim it; a firm holding a credit on
 * someone else's published project has stronger proof to lead with than
 * one we know nothing about. Those are facts in the database, so asking
 * an admin to look them up and pick accordingly only creates a way to
 * get it wrong — the worst of which is a claim link to somebody who
 * already owns the page. resolveOutboundSituation reads the state and
 * returns the situation; the entries here say what each one asks for.
 *
 * A SITUATION IS A BRIEF, NOT COPY. The words are written fresh by
 * generateComposeDraft in Niek's voice, grounded in real replies he
 * sent. These go out from niek@ to one person who may well reply, and a
 * template anyone can recognise as a template is worth less than no
 * mail at all.
 *
 * TWO THINGS THE DATABASE CANNOT KNOW. Whether you just spoke on the
 * phone — that is the tone below. And which of two equally valid asks
 * you want to make of a firm that is already live — which is why a
 * situation can offer alternatives.
 */

/**
 * Where the CTA goes in the body.
 *
 * The drafter places this on its own line at the point the mail earns
 * the click. The composer renders it as a fixed, uneditable link
 * between the paragraphs around it and swaps in the real URL at send.
 * A mail without the marker simply gets its link at the end.
 */
export const LINK_MARKER = "[[LINK]]"

/**
 * How these mails close. Part of the DRAFT, not a footer bolted on
 * afterwards — so it sits in the textarea where it can be edited or
 * dropped, like any other line the admin disagrees with.
 */
export const SIGN_OFF = "Niek\nArco · www.arcolist.com"

/** Did we just speak? The one thing no query can answer. */
export type OutboundTone = "called" | "cold"

export const TONE_LABEL: Record<OutboundTone, string> = {
  called: "Called",
  cold: "Cold",
}

export const TONE_INTENT: Record<OutboundTone, string> = {
  called:
    "You spoke on the phone moments ago. Refer to the call briefly and warmly without recapping it, and never claim more familiarity than one short call earns.",
  cold:
    "No call, no prior mail — this is the first thing they hear from you. Earn the read in the first sentence and keep the whole mail very short.",
}

export type OutboundSituationId =
  | "invited"
  | "visitor"
  | "showcase"
  | "outreach"
  | "owned_unlisted"
  | "listed_projects"
  | "listed_pros"

/**
 * Where the CTA points.
 *
 * 'claim' links carry a token, land on /claim and register a Pro
 * Visitor — they are the acquisition funnel. 'dashboard' links go to
 * people who already arrived, so they measure nothing about acquisition
 * and are tagged as Lifecycle to keep them out of that number.
 */
export type OutboundLinkKind = "claim" | "dashboard"

export type OutboundSituation = {
  id: OutboundSituationId
  /** Shown on the pill, and only when there is a choice to make. */
  label: string
  linkKind: OutboundLinkKind
  /** Prefilled, editable. */
  subject: string
  /**
   * The mail as it goes out, placeholders and all. This is what the
   * popup opens with; the AI is reached for through Regenerate, not on
   * the way in. {{voornaam}} and {{bedrijf}} are filled per recipient,
   * [[LINK]] is where the CTA lands.
   */
  body: string
  /** The brief behind the copy. Steers Regenerate, and says why the
   *  mail is written the way it is. */
  intent: string
  /** Text on the tracked link. */
  cta: string
}

export const OUTBOUND_SITUATIONS: Record<OutboundSituationId, OutboundSituation> = {
  invited: {
    id: "invited",
    label: "Openstaande credit",
    linkKind: "claim",
    subject: "Je werk staat al op Arco",
    body: `Hoi {{voornaam}},

Een bureau waarmee jullie hebben samengewerkt heeft een project op Arco gepubliceerd, en {{bedrijf}} staat daarin gecrediteerd.

[[LINK]]

Wat nog ontbreekt is een eigen pagina, zodat dat credit ook ergens heen wijst. Claimen is gratis en kost een paar minuten.

Niek
Arco · www.arcolist.com`,
    intent:
      "Someone published a project on Arco and credited this firm for their part in it. Their work is already live on another company's page; what is missing is a page of their own to attach it to. Lead with that project, because it is theirs and it is real. Claiming is free and takes a couple of minutes.",
    cta: "Bekijk het project en claim je pagina",
  },
  visitor: {
    id: "visitor",
    label: "Was al langs geweest",
    linkKind: "claim",
    subject: "Je was er bijna",
    body: `Hoi {{voornaam}},

Je hebt de pagina van {{bedrijf}} laatst bekeken, maar het claimen is blijven liggen.

[[LINK]]

Liep je ergens tegenaan? Laat het gerust weten — ook als het gewoon niet past, dan hoor ik dat liever dan dat ik je nog eens mail.

Niek
Arco · www.arcolist.com`,
    intent:
      "They opened their claim page once and did not finish. Do not start over and do not explain Arco again — pick up where they left off. Acknowledge lightly that they had a look, ask whether something got in the way, and make finishing the easy option. Genuinely leave room for 'not interested'.",
    cta: "Ga verder waar je gebleven was",
  },
  showcase: {
    id: "showcase",
    label: "Eigen werk gepubliceerd",
    linkKind: "claim",
    subject: "Je pagina op Arco",
    body: `Hoi {{voornaam}},

Werk van {{bedrijf}} staat al op Arco, dus jullie pagina bestaat al. Alleen is hij nog niet van jullie — dat kunnen alleen jullie zelf doen.

[[LINK]]

Even de gegevens nalopen en hij is van jullie. Er zitten geen kosten aan.

Niek
Arco · www.arcolist.com`,
    intent:
      "Their own published work is already on Arco, so their company page exists — it is just not theirs yet, because only they can claim it. Point at the page, say what it takes (claim it, check the details) and that it is free.",
    cta: "Bekijk en claim je pagina",
  },
  outreach: {
    id: "outreach",
    label: "Nog niets op Arco",
    linkKind: "claim",
    subject: "Wat vind je hiervan?",
    body: `Hoi {{voornaam}},

Ik heb een pagina voor {{bedrijf}} samengesteld op basis van jullie gepubliceerde werk. Benieuwd wat je ervan vindt.

[[LINK]]

Klopt er iets niet, of mist er werk? Ik hoor het graag — ook als het niets voor jullie is.

Niek
Arco · www.arcolist.com`,
    intent:
      "First contact with a firm that has nothing on Arco yet. We built a page for them from public project work and want their honest opinion on it. Lead with the page, not with Arco. Genuinely ask what they think, including what is wrong with it. Do not pitch, do not list features, and do not ask them to sign up.",
    cta: "Bekijk je pagina",
  },
  owned_unlisted: {
    id: "owned_unlisted",
    label: "Pagina afmaken",
    linkKind: "dashboard",
    subject: "Nog één stap tot je pagina live staat",
    body: `Hoi {{voornaam}},

De pagina van {{bedrijf}} staat klaar, maar is nog niet vindbaar: daarvoor is één goedgekeurd project nodig.

[[LINK]]

Een project toevoegen kost een paar minuten. Loop je ergens op vast, dan kijk ik even mee.

Niek
Arco · www.arcolist.com`,
    intent:
      "They own their page but it is not live yet, because a company page needs an approved project before anyone can find it. Say plainly what is missing and roughly how long it takes. This is not a pitch — they already said yes, and something practical is in the way.",
    cta: "Maak je pagina af",
  },
  listed_projects: {
    id: "listed_projects",
    label: "Projecten toevoegen",
    linkKind: "dashboard",
    subject: "Meer werk op je pagina",
    body: `Hoi {{voornaam}},

De pagina van {{bedrijf}} staat live. Er staat nu nog weinig werk op, en juist dat werk is waar mensen op zoeken.

[[LINK]]

Eén extra project kost een paar minuten en levert meteen meer manieren op om gevonden te worden.

Niek
Arco · www.arcolist.com`,
    intent:
      "Their page is live with little work on it, and more projects means more ways to be found. Keep it concrete and short: what kind of project would add the most, and that adding one takes a few minutes.",
    cta: "Voeg een project toe",
  },
  listed_pros: {
    id: "listed_pros",
    label: "Credit pros",
    linkKind: "dashboard",
    subject: "De pros achter je projecten",
    body: `Hoi {{voornaam}},

Een vraag: zou je bij de projecten van {{bedrijf}} willen aangeven met welke bureaus jullie hebben samengewerkt?

[[LINK]]

Het kost een paar minuten per project, en die bureaus krijgen er een eigen pagina door. Zo groeit het netwerk.

Niek
Arco · www.arcolist.com`,
    intent:
      "Ask them to name the firms they worked with on each of their projects. A couple of minutes per project, it gives those firms a page of their own, and it is how the network grows.",
    cta: "Credit de pros op je projecten",
  },
}

export function outboundSituation(id: string | null | undefined): OutboundSituation | null {
  if (!id) return null
  return OUTBOUND_SITUATIONS[id as OutboundSituationId] ?? null
}

// ── The editor's grid ────────────────────────────────────────────────
//
// /emails lets an admin browse every situation by picking a status and
// a channel. That grid is NOT a second model of the funnel: it resolves
// to the same situation ids the resolver produces, so a mail edited
// under "Prospect + Invite" is the mail a prospect with an open credit
// actually receives.
//
// Only combinations that can occur are offered. Channel is asked for
// exactly where it changes the answer — a listed company's mail does
// not depend on which claim funnel it once qualified for, and showing
// the row anyway would invite a choice that changes nothing.

export type EditorStatus = "prospect" | "contacted" | "visitor" | "owned" | "listed"
export type EditorChannel = "invite" | "showcase" | "outreach"

export const EDITOR_STATUSES: { id: EditorStatus; label: string }[] = [
  { id: "prospect", label: "Prospect" },
  { id: "contacted", label: "Contacted" },
  { id: "visitor", label: "Visitor" },
  { id: "owned", label: "Owned" },
  { id: "listed", label: "Listed" },
]

export const EDITOR_CHANNELS: { id: EditorChannel; label: string }[] = [
  { id: "invite", label: "Invite" },
  { id: "showcase", label: "Showcase" },
  { id: "outreach", label: "Outreach" },
]

/** Does picking a channel change which mail this status gets? */
export function statusNeedsChannel(status: EditorStatus): boolean {
  return status === "prospect" || status === "contacted"
}

/** Which mails this combination can produce. More than one means the
 *  state leaves a real choice, and the editor shows a third row. */
export function situationsFor(
  status: EditorStatus,
  channel: EditorChannel | null,
): OutboundSituationId[] {
  switch (status) {
    case "prospect":
    case "contacted":
      if (!channel) return []
      return [channel === "invite" ? "invited" : channel === "showcase" ? "showcase" : "outreach"]
    case "visitor":
      return ["visitor"]
    case "owned":
      return ["owned_unlisted"]
    case "listed":
      return ["listed_projects", "listed_pros"]
  }
}

/** Filled in per recipient when a saved body is used verbatim. */
export function fillPlaceholders(text: string, values: { voornaam: string; bedrijf: string }): string {
  return text
    .replace(/\{\{\s*voornaam\s*\}\}/gi, values.voornaam)
    .replace(/\{\{\s*bedrijf\s*\}\}/gi, values.bedrijf)
}
