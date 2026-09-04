"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"

import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import { checkUserExistsAction, signInWithOtpAction, signUpWithOtpAction } from "@/app/(auth)/actions"
import { resolveProfessionalServiceIcon } from "@/lib/icons/professional-services"
import { translateCategoryName, translateProfessionalService } from "@/lib/project-translations"
import type { ClaimChannel } from "@/lib/claim/claim-token"
import type { ClaimContext } from "@/lib/claim/context"

import { AddressLookup } from "@/components/address-lookup"
import { HeaderLanguageSwitcher } from "@/components/header-language-switcher"
import type { ResolvedAddress } from "@/lib/places/resolve-address"

import { saveCompanyStepAction, completeClaimAction, completeClaimExistingAction, finalizeClaimSignedInAction } from "./actions"
import { loadPlatformCompanyAction, sendPlatformDomainCodeAction, verifyPlatformDomainAndStartClaimAction } from "./platform-actions"
import {
  searchEstablishmentPredictions,
  resolveEstablishmentDetails,
  type EstablishmentPrediction,
  type ResolvedEstablishment,
} from "@/lib/places/resolve-address"
import styles from "./claim.module.css"

/**
 * The two claim screens: Your company (writes on Continue — the
 * ratchet), then You (account created at the commit). Design carried
 * over from the approved prototype: context as the header, form left,
 * the reason sticky on the right, fields underlined not boxed.
 */

type Screen = "company" | "you"

function domainFromWebsite(input: string): string | null {
  if (!input.trim()) return null
  try {
    const url = input.startsWith("http") ? input : `https://${input}`
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase() || null
  } catch {
    return null
  }
}

type SessionUser = { email: string; name: string; avatarUrl: string | null }

export function ClaimClient({ token, email, channel, sessionUser, initialScreen, ctx: initialCtx, initialPlatformCompanyId = null, initialRestoringPick = false }: {
  token: string
  email: string
  channel: ClaimChannel
  sessionUser: SessionUser | null
  initialScreen: Screen
  ctx: ClaimContext
  /** Tokenless pick rehydrated server-side (?c=) — arrive picked. */
  initialPlatformCompanyId?: string | null
  /** Tokenless Google pick (?p=) resolving client-side — show a
   *  loading state instead of flashing the search screen. */
  initialRestoringPick?: boolean
}) {
  const t = useTranslations("claim")
  const locale = useLocale()
  // Platform TOKENLESS mode: search + company step + inline domain
  // verification, which mints a claim token and reloads this page WITH
  // it — from that point on channel "platform" behaves exactly like a
  // token channel (codeless account step, OAuth, ratchet writes).
  const isPlatform = channel === "platform" && !token
  const [ctx, setCtx] = useState(initialCtx)
  // Platform proof anchor: an existing pick or place brings a domain;
  // otherwise the website field supplies one.
  const [website, setWebsite] = useState("")
  const websiteDomain = domainFromWebsite(website)
  const domain = ctx.company.domain ?? (isPlatform ? websiteDomain ?? "" : email.split("@")[1] ?? "")

  const [screen, setScreen] = useState<Screen>(initialScreen)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // company step — serviceIds is ORDERED: first is the primary, same
  // contract as the "Selecteer diensten" popup in company edit.
  const [name, setName] = useState(ctx.company.name)
  // Set only by a Places pick — free text never enters the location.
  const [location, setLocation] = useState<ResolvedAddress | null>(null)
  const [editingAddress, setEditingAddress] = useState(!ctx.company.address)
  const [serviceIds, setServiceIds] = useState<string[]>(
    ctx.creditedService ? [ctx.creditedService.id] : ctx.company.primaryServiceId ? [ctx.company.primaryServiceId] : [],
  )
  // Veldfouten volgens /design: destructive label, input-error rand,
  // arco-small-text melding onder het veld. Gezet bij Doorgaan, per veld
  // gewist zodra de gebruiker het herstelt.
  const [fieldErrors, setFieldErrors] = useState<{ name?: boolean; address?: boolean; service?: boolean; website?: boolean }>({})
  const [showAllCredits, setShowAllCredits] = useState(false)
  const [photoIdx, setPhotoIdx] = useState(0)
  const dragFrom = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  // you step — email-first. The address decides the rest of the screen:
  //   has account            → sign-in code
  //   no account, invited    → names only, no code (delivery was proof)
  //   no account, different  → names + code (normal account creation)
  const [session, setSession] = useState<SessionUser | null>(sessionUser)
  const [emailValue, setEmailValue] = useState(email)
  const [namesMode, setNamesMode] = useState(false)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  // Inline code entry — no popup. exists=true means a sign-in code went
  // out; namesMode + !isInvited means a signup code follows the names.
  const [existsFlow, setExistsFlow] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState(["", "", "", "", "", ""])
  const otpRefs = useRef<Array<HTMLInputElement | null>>([])
  // Platform mode never has an invited (pre-proven) address — email=""
  // would otherwise make the empty field read as invited.
  const isInvited = !isPlatform && emailValue.trim().toLowerCase() === email.toLowerCase()

  // Platform: what the commit needs to know about the pick.
  const [platformCompanyId, setPlatformCompanyId] = useState<string | null>(initialPlatformCompanyId)
  const [restoringPick, setRestoringPick] = useState(initialRestoringPick)
  const [placeData, setPlaceData] = useState<ResolvedEstablishment | null>(null)
  // Find screen search state — Arco DB + Google establishments, debounced.
  const [findQuery, setFindQuery] = useState("")
  const [findResults, setFindResults] = useState<Array<
    | { kind: "arco"; id: string; name: string; city: string | null; claimed: boolean }
    | { kind: "google"; placeId: string; name: string; city: string | null }
  >>([])
  const [findSearching, setFindSearching] = useState(false)
  const [findBusy, setFindBusy] = useState(false)
  // Which claimed row's "already managed" explainer is open.
  const [claimedInfoId, setClaimedInfoId] = useState<string | null>(null)
  // Merged platform step: the form unfolds once a company is picked;
  // "Wijzig" on the company field folds it back into the search. A
  // server-rehydrated pick arrives already unfolded.
  const [platformPicked, setPlatformPicked] = useState(Boolean(initialPlatformCompanyId))
  // Flipped verification: the code is requested and entered ON the
  // company step; success mints the token and leaves tokenless mode.
  const [verifyLocal, setVerifyLocal] = useState("")
  const [platformCodeSent, setPlatformCodeSent] = useState(false)
  const [platformSentTo, setPlatformSentTo] = useState("")
  const findTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Where the login modal sends people back to: this exact claim link.
  // The GET never consumes the token, so the round trip is free.
  const selfUrl = `/claim?t=${encodeURIComponent(token)}&step=you`

  // Apollo-imported rows often carry name+city+domain but no address.
  // When a funnel shows such a company, look its establishment up on
  // Places and prefill the address — accepted ONLY when the Google
  // profile's website domain equals the company's own domain (near-
  // conclusive identity; name similarity is not required). Among
  // same-domain hits, a matching city picks the right branch. The
  // result stays a proposal: the field shows it with Wijzig beside it.
  const prefillTried = useRef<Set<string>>(new Set())
  useEffect(() => {
    const co = ctx.company
    if (!co.name || !co.domain || co.address || location) return
    // Tokenless platform hides the address field (it follows after
    // verification, on the token screen) — no point spending Places
    // calls here; the token-mode mount runs this again.
    if (isPlatform) return
    const key = co.id || co.name
    if (prefillTried.current.has(key)) return
    prefillTried.current.add(key)
    let cancelled = false
    ;(async () => {
      const norm = (d: string) => d.toLowerCase().replace(/^www\./, "")
      const preds = await searchEstablishmentPredictions([co.name, co.city].filter(Boolean).join(" "))
      const matches: ResolvedEstablishment[] = []
      for (const pred of preds.slice(0, 3)) {
        const det = await resolveEstablishmentDetails(pred.placeId)
        if (cancelled) return
        if (det?.domain && det.formattedAddress && norm(det.domain) === norm(co.domain!)) {
          matches.push(det)
          // City confirms the branch — stop early on a full match.
          if (!co.city || det.city?.toLowerCase() === co.city.toLowerCase()) break
        }
      }
      const best = matches.find((m) => !co.city || m.city?.toLowerCase() === co.city?.toLowerCase()) ?? matches[0]
      if (!best || cancelled) return
      setLocation({
        formattedAddress: best.formattedAddress!,
        streetAddress: best.formattedAddress!,
        city: best.city,
        stateRegion: best.stateRegion,
        country: best.country,
        placeId: best.placeId,
        latitude: best.latitude,
        longitude: best.longitude,
      })
      setEditingAddress(false)
      setFieldErrors((f) => ({ ...f, address: undefined }))
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.company.id, ctx.company.address, platformPicked])

  const serviceById = useMemo(() => {
    const m = new Map<string, { id: string; name: string; slug: string | null; imageUrl: string | null }>()
    for (const g of ctx.taxonomy) for (const s of g.services) m.set(s.id, s)
    return m
  }, [ctx.taxonomy])
  const primaryService = serviceIds.length ? serviceById.get(serviceIds[0]) ?? null : null

  const svcLabel = (s: { name: string; slug: string | null }) =>
    translateProfessionalService(s.slug ?? s.name, locale) ?? s.name
  // Parent-group NL labels live in the professional-service map, which
  // covers parents and children alike; translateCategoryName only knows
  // a partial, older set.
  const groupLabel = (g: { name: string; slug: string | null }) =>
    translateProfessionalService(g.slug ?? g.name, locale) ?? g.name

  // Records verschillen: soms een volledig geformatteerd adres met
  // postcode en land, soms alleen straat+nummer. Toon overal dezelfde
  // vorm — "straat nummer, stad" — land en postcode eraf, stad erbij
  // als die nog ontbreekt.
  const displayAddress = (() => {
    const base = (location?.formattedAddress ?? ctx.company.address ?? "")
      .replace(/, (Netherlands|Nederland)$/i, "")
      .replace(/,\s*\d{4}\s?[A-Z]{2}\s+/g, ", ")
    const city = location?.city ?? ctx.company.city
    if (!base) return city ?? ""
    if (city && !base.toLowerCase().includes(city.toLowerCase())) return `${base}, ${city}`
    return base
  })()

  function toggleService(id: string) {
    setServiceIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
    setFieldErrors((f) => ({ ...f, service: undefined }))
  }

  // ── platform find screen ──────────────────────────────────────────
  function searchCompanies(q: string) {
    setFindQuery(q)
    setError(null)
    if (findTimer.current) clearTimeout(findTimer.current)
    if (q.trim().length < 2) { setFindResults([]); return }
    findTimer.current = setTimeout(async () => {
      setFindSearching(true)
      const supabase = getBrowserSupabaseClient()
      // One merged list. Claimed companies stay VISIBLE (marked, not
      // pickable): hiding them reads as "not on Arco" and sends the
      // visitor into creating a duplicate via a Google row.
      const [db, google] = await Promise.all([
        supabase
          .from("companies")
          .select("id, name, city, owner_id")
          .ilike("name", `%${q.trim()}%`)
          .limit(5),
        searchEstablishmentPredictions(q),
      ])
      const arco = ((db.data ?? []) as Array<{ id: string; name: string; city: string | null; owner_id: string | null }>)
        .map((c) => ({ kind: "arco" as const, id: c.id, name: c.name, city: c.city, claimed: c.owner_id !== null }))

      // A Google hit that IS an Arco company (same google_place_id)
      // becomes an Arco row under its ARCO name — Google's registration
      // ("Bongers Architecten BNA | Architectenbureau") often differs
      // from the name the page carries here.
      const placeIds = google.map((g) => g.placeId).filter(Boolean)
      const knownPlaceIds = new Set<string>()
      if (placeIds.length > 0) {
        const { data: placeMatches } = await supabase
          .from("companies")
          .select("id, name, city, owner_id, google_place_id")
          .in("google_place_id", placeIds)
        for (const m of placeMatches ?? []) {
          if (m.google_place_id) knownPlaceIds.add(m.google_place_id)
          if (!arco.some((a) => a.id === m.id)) {
            arco.push({ kind: "arco", id: m.id, name: m.name ?? "", city: m.city ?? null, claimed: m.owner_id !== null })
          }
        }
      }

      // Fuzzy name fold: Google registrations pad the Arco name at
      // either end ("Studio Marco van Veldhuizen", "Bongers Architecten
      // BNA | Architectenbureau"). Fold when one normalised name extends
      // the other on a word boundary, front or back — but only for
      // multi-word names, so an Arco row "Bongers" can't swallow
      // "Bongers Oefentherapie".
      const normalize = (v: string) => v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim()
      const sameCompany = (a: string, b: string) => {
        const na = normalize(a); const nb = normalize(b)
        if (!na || !nb) return false
        if (na === nb) return true
        const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na]
        return short.includes(" ") && (long.startsWith(short + " ") || long.endsWith(" " + short))
      }
      const googleRows = google
        .filter((g) => !knownPlaceIds.has(g.placeId) && !arco.some((a) => sameCompany(a.name, g.name)))
        .map((g) => ({ kind: "google" as const, placeId: g.placeId, name: g.name, city: g.city }))
      setFindResults([...arco, ...googleRows])
      setFindSearching(false)
    }, 300)
  }

  /** A pick replaces the context and re-seeds the form state that was
   *  initialised from the (empty) initial context at mount. */
  function applyPickedCtx(next: ClaimContext) {
    setCtx(next)
    setName(next.company.name)
    setServiceIds(next.company.primaryServiceId ? [next.company.primaryServiceId] : [])
    setLocation(null)
    setEditingAddress(!next.company.address)
    setFieldErrors({})
    setError(null)
    // A different company is a different proof anchor: everything of
    // the verification starts over — local part, sent state, code.
    setVerifyLocal("")
    setPlatformCodeSent(false)
    setPlatformSentTo("")
    setOtp(["", "", "", "", "", ""])
    setPlatformPicked(true)
  }

  /** The pick lives in the querystring too (?c= Arco row, ?p= Google
   *  place): the language switcher navigates but keeps the query, so a
   *  locale change — or a refresh — rehydrates the pick instead of
   *  dropping the visitor back into the search. replaceState, not the
   *  router: a route transition would remount and lose the rest. */
  /** Step 2 in the URL too — the locale switcher navigates and keeps
   *  the query, so a language change on the account step must not
   *  restart the visitor at the company review. */
  function writeStepParam(you: boolean) {
    const url = new URL(window.location.href)
    if (you) url.searchParams.set("step", "you")
    else url.searchParams.delete("step")
    window.history.replaceState(null, "", url.toString())
  }

  function writePickParam(key: "c" | "p" | null, value?: string) {
    const url = new URL(window.location.href)
    url.searchParams.delete("c")
    url.searchParams.delete("p")
    if (key && value) url.searchParams.set(key, value)
    window.history.replaceState(null, "", url.toString())
  }

  async function pickArcoCompany(id: string) {
    setFindBusy(true); setError(null)
    const res = await loadPlatformCompanyAction(id)
    setFindBusy(false)
    if (!res.ok) { setError(res.error); return }
    setPlatformCompanyId(id)
    setPlaceData(null)
    setWebsite("")
    writePickParam("c", id)
    applyPickedCtx(res.ctx)
  }

  async function pickGooglePlace(pred: EstablishmentPrediction, opts?: { silent?: boolean }) {
    setFindBusy(true); setError(null)
    let place = await resolveEstablishmentDetails(pred.placeId)
    setFindBusy(false)
    if (!place && pred.name) {
      // Details down ≠ dead end: the prediction already carries name and
      // city, and the funnel collects the rest anyway (website field for
      // the domain, address on the token step). Degrade, don't block.
      place = {
        name: pred.name, placeId: pred.placeId, formattedAddress: null,
        city: pred.city, country: null, stateRegion: null, phone: null,
        website: null, domain: null, editorialSummary: null,
        googleTypes: null, latitude: null, longitude: null,
      }
    }
    if (!place) {
      // Rehydration failure is not the visitor's doing: drop the stale
      // param and land on a clean search, no error banner.
      if (opts?.silent) { writePickParam(null); return }
      setError(t("address_error")); return
    }
    setPlatformCompanyId(null)
    setPlaceData(place)
    setWebsite(place.website ?? "")
    writePickParam("p", place.placeId)
    applyPickedCtx({
      ...ctx,
      company: {
        ...ctx.company,
        id: "", name: place.name, slug: null,
        city: place.city, address: place.formattedAddress,
        domain: place.domain, logoUrl: null, heroPhotoUrl: null,
        primaryServiceId: null, ownerId: null,
      },
      creditedService: null, project: null, roster: [],
    })
  }

  // Rehydrate a pick carried in the URL — a locale switch or refresh
  // lands here with ?c=/?p= still set.
  const pickRestored = useRef(false)
  useEffect(() => {
    if (!isPlatform || platformPicked || pickRestored.current) return
    pickRestored.current = true
    const params = new URLSearchParams(window.location.search)
    const c = params.get("c")
    const pl = params.get("p")
    if (c) void pickArcoCompany(c).finally(() => setRestoringPick(false))
    else if (pl) void pickGooglePlace({ placeId: pl, name: "", city: null }, { silent: true }).finally(() => setRestoringPick(false))
    else setRestoringPick(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function submitCompany() {
    const fe = {
      name: !name.trim() || undefined,
      address: (!location && !ctx.company.address) || undefined,
      service: serviceIds.length === 0 || undefined,
      // Platform: the domain is the proof anchor — without one from the
      // pick, the website field must supply it.
      website: (isPlatform && !domain) || undefined,
    }
    setFieldErrors(fe)
    if (fe.name || fe.address || fe.service || fe.website) return
    setBusy(true); setError(null)
    const res = await saveCompanyStepAction({
      token, name,
      location: location
        ? {
            formattedAddress: location.formattedAddress,
            city: location.city,
            stateRegion: location.stateRegion,
            country: location.country,
            placeId: location.placeId,
            latitude: location.latitude,
            longitude: location.longitude,
          }
        : null,
      primaryServiceId: serviceIds[0] ?? null, serviceIds,
    })
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    setScreen("you")
    writeStepParam(true)
    window.scrollTo({ top: 0 })
  }

  /** Platform: validate the identity (name + domain), then send the
   *  domain code. Location and services follow on the token screen. */
  async function sendPlatformCode() {
    const fe = {
      name: !name.trim() || undefined,
      website: !domain || undefined,
    }
    setFieldErrors(fe)
    if (fe.name || fe.website) return
    if (!verifyLocal.trim()) { setError(t("required_verify_email")); return }
    setBusy(true); setError(null)
    const res = await sendPlatformDomainCodeAction({
      companyId: platformCompanyId,
      domain: domain || null,
      emailLocal: verifyLocal,
      companyName: name,
    })
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    setPlatformCodeSent(true)
    setPlatformSentTo(res.email)
    setOtp(["", "", "", "", "", ""])
    setTimeout(() => otpRefs.current[0]?.focus(), 50)
  }

  /** Platform: a valid code writes the company step server-side, mints
   *  the claim token and re-enters this page AS a token channel. */
  async function verifyPlatformCode() {
    setBusy(true); setError(null)
    const res = await verifyPlatformDomainAndStartClaimAction({
      code: otp.join(""),
      emailLocal: verifyLocal,
      companyId: platformCompanyId,
      place: placeData
        ? {
            name: placeData.name, placeId: placeData.placeId,
            formattedAddress: placeData.formattedAddress, city: placeData.city,
            country: placeData.country, stateRegion: placeData.stateRegion,
            phone: placeData.phone, website: placeData.website, domain: placeData.domain,
          }
        : null,
      name,
      website: website.trim() || placeData?.website || null,
      domain: domain || null,
    })
    if (!res.ok) { setBusy(false); setError(res.error); return }
    // No &step=you: the token company step is next — location and
    // services land there, through the same ratchet as every channel.
    window.location.href = `/${locale}/claim?t=${encodeURIComponent(res.token)}`
  }

  function onEmailEdited(v: string) {
    setEmailValue(v)
    setNamesMode(false); setExistsFlow(false); setOtpSent(false)
    setOtp(["", "", "", "", "", ""]); setError(null)
  }

  // The email decides, all of it inline — no popup:
  //   account exists         → sign-in code, entered right here
  //   invited, no account    → names, no code (delivery was the proof)
  //   different, no account  → names, then a signup code
  async function gaVerder() {
    const addr = emailValue.trim()
    if (!addr || !addr.includes("@")) { setError(t("swap_need_fields")); return }
    setBusy(true); setError(null)
    const res = await checkUserExistsAction(addr)
    if ("error" in res && res.error) { setBusy(false); setError(res.error.message); return }
    const exists = Boolean((res as { data?: { exists: boolean } }).data?.exists)
    if (exists) {
      // The PROVEN address (token e-mail) with an existing account
      // needs no second code — the token already proved this mailbox
      // (delivery, or the step-1 domain code). Claim + sign in in one
      // server round trip; any failure falls back to the code flow.
      if (isInvited) {
        const done = await completeClaimExistingAction(token)
        if (done.status === "done") { window.location.href = done.loginUrl; return }
        if (done.status === "error") { setBusy(false); setError(done.error); return }
        // no_account: fall through to the normal sign-in code below.
      }
      const sent = await signInWithOtpAction({ email: addr })
      setBusy(false)
      if ("error" in sent && sent.error) { setError(sent.error.message); return }
      setExistsFlow(true); setOtpSent(true)
      setTimeout(() => otpRefs.current[0]?.focus(), 50)
      return
    }
    setBusy(false)
    setNamesMode(true)
  }

  // Invited address, no account: the codeless commit.
  async function submitComplete() {
    setBusy(true); setError(null)
    const res = await completeClaimAction({ token, firstName, lastName })
    if (res.status === "done") { window.location.href = res.loginUrl; return }
    setBusy(false)
    if (res.status === "existing_account") {
      // Backstop: the account appeared between check and commit — fall
      // into the inline sign-in-code flow for it.
      setNamesMode(false); setExistsFlow(true); setOtpSent(true)
      await signInWithOtpAction({ email: emailValue.trim() })
      setError(t("existing_code_hint", { email: res.email }))
      return
    }
    setError(res.error)
  }

  // Different address, no account: normal creation — names, then a code.
  async function sendSignupCode() {
    if (!firstName.trim()) { setError(t("swap_need_fields")); return }
    setBusy(true); setError(null)
    const res = await signUpWithOtpAction({
      email: emailValue.trim(), firstName: firstName.trim(),
      lastName: lastName.trim() || undefined,
    })
    setBusy(false)
    if ("error" in res && res.error) { setError(res.error.message); return }
    setOtpSent(true)
    setTimeout(() => otpRefs.current[0]?.focus(), 50)
  }

  async function verifyOtpCode() {
    setBusy(true); setError(null)
    const supabase = getBrowserSupabaseClient()
    const { error: otpError } = await supabase.auth.verifyOtp({
      email: emailValue.trim(), token: otp.join(""), type: "email",
    })
    if (otpError) { setBusy(false); setError(otpError.message); return }
    const res = await finalizeClaimSignedInAction(token)
    if (res.status === "done") { window.location.href = res.redirectTo; return }
    setBusy(false); setError(res.error)
  }

  async function publishSignedIn() {
    setBusy(true); setError(null)
    const res = await finalizeClaimSignedInAction(token)
    if (res.status === "done") { window.location.href = res.redirectTo; return }
    setBusy(false); setError(res.error)
  }

  // Same OAuth entry as the login modal, returning to this claim link.
  async function continueWithGoogle() {
    const supabase = getBrowserSupabaseClient()
    const callback = `${window.location.origin}/auth/callback?redirect_to=${encodeURIComponent(selfUrl)}`
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback },
    })
    if (oauthError) setError(oauthError.message)
  }

  async function switchAccount() {
    await getBrowserSupabaseClient().auth.signOut()
    setSession(null); setError(null)
  }

  // The six code boxes — shared between the account step's sign-in /
  // signup codes and the platform company step's domain code. Paste and
  // iOS autofill both distribute across the boxes.
  const otpRow = (
    <div className={styles.otpRow} style={{ marginTop: 0 }}>
                      {otp.map((d, idx) => (
                        <input key={idx} className={styles.otpBox} inputMode="numeric"
                          value={d}
                          autoComplete={idx === 0 ? "one-time-code" : "off"}
                          ref={(el) => { otpRefs.current[idx] = el }}
                          onPaste={(e) => {
                            // A pasted code fills all six boxes at once.
                            const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
                            if (digits.length < 2) return
                            e.preventDefault()
                            const next = ["", "", "", "", "", ""]
                            for (let i = 0; i < digits.length; i++) next[i] = digits[i]
                            setOtp(next)
                            otpRefs.current[Math.min(digits.length, 5)]?.focus()
                          }}
                          onChange={(e) => {
                            // Also handles iOS autofill, which types the
                            // whole code into one box.
                            const v = e.target.value.replace(/\D/g, "")
                            if (v.length > 1) {
                              const next = [...otp]
                              for (let i = 0; i < v.length && idx + i < 6; i++) next[idx + i] = v[i]
                              setOtp(next)
                              otpRefs.current[Math.min(idx + v.length, 5)]?.focus()
                              return
                            }
                            const next = [...otp]; next[idx] = v; setOtp(next)
                            if (v && idx < 5) otpRefs.current[idx + 1]?.focus()
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Backspace" && !otp[idx] && idx > 0) otpRefs.current[idx - 1]?.focus()
                          }} />
                      ))}
                    </div>
  )

  // A funnel header, on purpose: the real logo (deliberately NOT a
  // link — navigation mid-claim is an exit) and the step count. No nav,
  // no search, no account. Anything else on it is a way out.
  const termsRich = (key: "terms_note" | "terms_note_signed") =>
    t.rich(key, {
      // Kale anchors: de globale `p a`-regel geeft ze de inline-stijl uit
      // /design — kleur erft mee, grijze rule in rust, zwart op hover.
      terms: (chunks) => <Link href="/terms" target="_blank" rel="noopener noreferrer">{chunks}</Link>,
      privacy: (chunks) => <Link href="/privacy" target="_blank" rel="noopener noreferrer">{chunks}</Link>,
    })

  const header = (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <img
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Arco%20Logo%20Large%20%281%29-DDrzilvIhjI3lRfCVwKO1XpAs6LDc6.svg"
          alt="Arco"
          className={styles.logo}
        />
        <span style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <span className={styles.step}>
            {t("step_of", { n: screen === "company" ? 1 : 2, total: 2 })}
          </span>
          {/* Taal wisselen is geen exit: zelfde pagina, andere locale, en
              de switcher bewaart de querystring — het token overleeft. */}
          <HeaderLanguageSwitcher />
        </span>
      </div>
    </header>
  )

  // Showcase & outreach: de professional-kaart zoals op discover — hero,
  // logo, naam, "Dienst +N · Stad". Alles volgt het formulier live.
  // Hero gelaagd op basis van de DATA, niet het kanaal: heeft het
  // bedrijf al werk op Arco, dan staat die echte foto er (ook in de
  // outreach-funnel); anders de voorbeeldfoto van de gekozen
  // hoofddienst (de homepage-tegels, met VOORBEELD-badge); anders de
  // hand-getekende mark.
  const extraServices = Math.max(serviceIds.length - 1, 0)
  const [showPrevServices, setShowPrevServices] = useState(false)
  const prevServicesRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!showPrevServices) return
    const handler = (e: MouseEvent) => {
      if (prevServicesRef.current && !prevServicesRef.current.contains(e.target as Node)) {
        setShowPrevServices(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showPrevServices])
  const heroSrc = ctx.company.heroPhotoUrl ?? primaryService?.imageUrl ?? null
  const heroIsExample = !ctx.company.heroPhotoUrl
  const HeroMark = resolveProfessionalServiceIcon(primaryService?.slug ?? null, null)
  // The tokenless platform phase shows NO preview: before services and
  // address there is nothing to preview but an empty wash. The card
  // appears on the token company step, where the form brings it alive.
  const proCardPreview = (channel === "showcase" || channel === "outreach" || (channel === "platform" && !isPlatform)) && (
    <article className={styles.previewCard}>
      <div className="discover-card-image-wrap" style={{ aspectRatio: "3/2" }}>
        <div className="discover-card-image-layer" style={!heroSrc ? { display: "grid", placeItems: "center", background: "var(--arco-wash)" } : undefined}>
          {heroSrc
            ? <img src={heroSrc} alt="" />
            : HeroMark
              ? <HeroMark style={{ width: 72, height: 72, color: "var(--arco-mid)" }} strokeWidth={1} />
              : null}
        </div>
        {heroIsExample && heroSrc && (
          <span className={styles.exampleBadge}>{t("example_badge")}</span>
        )}
      </div>
      <div className="pro-card-info">
        {ctx.company.logoUrl ? (
          <img src={ctx.company.logoUrl} alt="" className="pro-card-logo" width={34} height={34} />
        ) : (
          /* No logo: the service mark (or the generic professional mark
             before a service is picked) — never a bare initial. */
          <div className="pro-card-logo pro-card-logo-placeholder" style={{ display: "grid", placeItems: "center" }}>
            {HeroMark && <HeroMark style={{ width: 18, height: 18, color: "var(--arco-mid)" }} strokeWidth={1.5} />}
          </div>
        )}
        <div>
          <h3 className="discover-card-title">{name}</h3>
          <p className="discover-card-sub">
            {primaryService ? svcLabel(primaryService) : ""}
            {extraServices > 0 && (
              <span className="pro-card-extra" ref={prevServicesRef}>
                <button type="button" className="pro-card-extra-btn" onClick={() => setShowPrevServices((v) => !v)}>
                  +{extraServices}
                </button>
                {showPrevServices && (
                  <span className="pro-card-dropdown">
                    {serviceIds.map((id) => serviceById.get(id)).filter(Boolean).map((svc, i) => (
                      <span key={i} className="pro-card-dropdown-item">{svcLabel(svc!)}</span>
                    ))}
                  </span>
                )}
              </span>
            )}
            {ctx.company.city ? (primaryService ? ` · ${ctx.company.city}` : ctx.company.city) : ""}
          </p>
        </div>
      </div>
    </article>
  )

  // The discover card, verbatim: 4:3 image, hover arrows + dots cycling
  // the real project photos, title, city with the owner in the accent.
  const photos = ctx.project?.photoUrls ?? []
  const photo = photos[photoIdx % Math.max(photos.length, 1)]
  const projectCard = ctx.project && (
    <article className={`discover-card ${styles.previewCard}`}>
      <div className="discover-card-image-wrap">
        <div className="discover-card-image-layer">
          {photo && <img key={photo} src={photo} alt="" />}
        </div>
        {photos.length > 1 && (
          <>
            <div className="discover-card-nav-arrows">
              {[-1, 1].map((dir) => (
                <button key={dir} type="button" className="discover-card-nav-arrow"
                  aria-label={dir === -1 ? "‹" : "›"}
                  onClick={() => setPhotoIdx((i) => (i + dir + photos.length) % photos.length)}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    {dir === -1 ? <path d="M10 3 5 8l5 5" /> : <path d="M6 3l5 5-5 5" />}
                  </svg>
                </button>
              ))}
            </div>
            <div className="discover-card-dots">
              {photos.map((_, i) => (
                <span key={i} className={`discover-card-dot${i === photoIdx ? " active" : ""}`} />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="discover-card-title">{ctx.project.title}</div>
      <div className="discover-card-sub">
        {[translateCategoryName(ctx.project.typeSlug, locale), ctx.project.city]
          .filter(Boolean).join(" · ")}
        {ctx.project.inviterName && (
          <> · <span style={{ color: "var(--primary)" }}>{ctx.project.inviterName}</span></>
        )}
      </div>
    </article>
  )

  // Credited professionals — exactly as the project detail page shows
  // them: serif heading, everyone visible at the same size, nobody
  // dimmed, no card chrome around it. The one addition is the "Jij"
  // marker on the recipient's own cell.
  const rosterCard = ctx.roster.length > 0 && (
    <div style={{ marginTop: 8 }}>
      <p className="arco-eyebrow" style={{ marginBottom: 18 }}>
        {t("credited_professionals")}
      </p>
      {/* Horizontal rows — the mobile project-edit credit layout: circle
          left, name with the service stacked beneath it. */}
      <div className={styles.prosList}>
        {(showAllCredits ? ctx.roster : ctx.roster.slice(0, 2)).map((r, idx) => {
          const Icon = resolveProfessionalServiceIcon(r.serviceSlug, null)
          const initials = r.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
          return (
            <div key={idx} className={styles.proRow}>
              <div className="credit-icon" style={{ width: 52, height: 52, margin: 0, flex: "none" }}>
                {r.logoUrl
                  ? <img src={r.logoUrl} alt="" />
                  : Icon
                    ? <Icon className="credit-icon-service" style={{ width: 28, height: 28 }} />
                    : <span className="credit-icon-initials" style={{ fontSize: 18 }}>{initials}</span>}
              </div>
              <div>
                <div className={styles.proName}>
                  {/* The recipient's own row tracks the form live — it is
                      a preview of their credit, so an edited name shows
                      up here immediately. */}
                  {r.isSelf ? name : r.name}
                  {r.isSelf && <span className={styles.youMark}>{t("status_you")}</span>}
                </div>
                <div className={styles.proSvc}>
                  {r.serviceSlug || r.serviceName
                    ? translateProfessionalService(r.serviceSlug ?? r.serviceName, locale) ?? r.serviceName
                    : "—"}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {ctx.roster.length > 2 && (
        <button type="button" className="arco-text-link arco-text-link--primary"
          style={{ marginTop: 14 }}
          onClick={() => setShowAllCredits(!showAllCredits)}>
          {showAllCredits
            ? t("x_less")
            : t("plus_more", { count: ctx.roster.length - 2 })}
        </button>
      )}
    </div>
  )

  /* ── screen 1 · your company ─────────────────────────────────── */
  if (screen === "company") {
    // The recipient's own category leads (a firm's other services are
    // usually siblings of the credited one); the rest sit behind a
    // "show more". No search — five short groups don't need one.
    const myGroup =
      ctx.taxonomy.find((g) => g.services.some((s) => s.id === serviceIds[0]))
      ?? ctx.taxonomy[0]
    return (
      <>
        {header}
        <div className={styles.body}><div className={styles.wrap}>
          <div className={styles.grid}>
            <div className={`${styles.intro} ${styles.introArea}`}>
              <h1 className={`arco-page-title ${styles.display}`}>
                {isPlatform
                  ? t("platform_title")
                  : channel === "showcase"
                    ? t("showcase_title")
                    : ctx.project?.title
                      ? t("company_title_project", { project: ctx.project.title })
                      : t("company_title_plain")}
              </h1>
              <p className={`arco-body-text ${styles.lede}`}>
                {isPlatform
                  ? (platformPicked || restoringPick ? t("company_lede_plain") : t("platform_lede"))
                  : channel === "showcase"
                    ? t("showcase_lede", { company: ctx.company.name })
                    : ctx.project?.inviterName
                      ? t("company_lede", { inviter: ctx.project.inviterName })
                      : t("company_lede_plain")}
              </p>
            </div>
            <div className={styles.mainArea}>
              {isPlatform && !platformPicked && restoringPick ? (
                /* A locale switch mid-pick: the Google pick is being
                   re-resolved — show the field as loading, never a
                   flash of the empty search. */
                <div className={styles.field}>
                  <span className={styles.label}>{t("field_company")}</span>
                  <div className={styles.addrShown}>
                    <span className={styles.addrText} style={{ color: "var(--arco-light)" }}>{t("restoring_pick")}</span>
                  </div>
                </div>
              ) : isPlatform && !platformPicked ? (
                /* Merged step: the company field IS the search until a
                   pick lands; the rest of the form unfolds below it. */
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="cl-find">{t("field_company")}</label>
                  <input className={styles.input} id="cl-find" value={findQuery} autoFocus
                    placeholder={t("find_placeholder")} autoComplete="off"
                    onChange={(e) => searchCompanies(e.target.value)} />

                  {findResults.length > 0 && (
                    <div className={styles.findRows} style={{ marginTop: 10 }}>
                      {findResults.map((r) => {
                        const claimed = r.kind === "arco" && r.claimed
                        const rowKey = r.kind === "arco" ? r.id : r.placeId
                        return (
                          <div key={rowKey}>
                            <button
                              type="button" className={styles.findRow}
                              disabled={findBusy}
                              onClick={() => {
                                if (r.kind === "google") { pickGooglePlace({ placeId: r.placeId, name: r.name, city: r.city }); return }
                                if (claimed) { setClaimedInfoId((prev) => (prev === r.id ? null : r.id)); return }
                                pickArcoCompany(r.id)
                              }}>
                              <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                                {r.kind === "arco" && (
                                  <span className={claimed ? styles.findBadge : styles.findBadgeClaim}>
                                    {claimed ? t("find_label_on_arco") : t("find_label_claim")}
                                  </span>
                                )}
                              </span>
                              <span className={styles.findMeta}>{r.city ?? ""}</span>
                            </button>
                            {claimed && claimedInfoId === r.id && (
                              <p className={styles.note} style={{ margin: "8px 2px 4px" }}>
                                {t("find_claimed_note", { company: r.name })}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {findSearching && findResults.length === 0 && (
                    <p className={styles.note}>…</p>
                  )}

                  {error && <p className={styles.error}>{error}</p>}

                  {/* Handmatig toevoegen staat bewust UIT: de zoeker is
                      NL-only (Places country=nl + Arco-rows) en een vrij
                      invoerpad zou buitenlandse rijen binnenlaten. De
                      regel hieronder is de plek waar t.z.t. de
                      interessepeiling voor andere landen komt. */}
                  {findQuery.trim().length >= 2 && !findSearching && (
                    <p className={styles.note} style={{ marginTop: 14 }}>
                      {t("find_not_listed")} {t("find_nl_only")}
                    </p>
                  )}
                </div>
              ) : isPlatform ? (
                /* Picked: the name is a plain editable field (fixing the
                   title never changes WHICH company this is), with a
                   separate line to swap the company — that reopens the
                   search. */
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="cl-name"
                    style={fieldErrors.name ? { color: "var(--destructive)" } : undefined}>
                    {t("field_company")}
                  </label>
                  <div className={styles.inputWithAction}>
                    <input className={`${styles.input} ${styles.inputActionPad}${fieldErrors.name ? " input-error" : ""}`} id="cl-name" value={name}
                      onChange={(e) => { setName(e.target.value); setFieldErrors((f) => ({ ...f, name: undefined })) }} />
                    <button type="button" className={`arco-text-link ${styles.inputAction}`}
                      onClick={() => {
                        setPlatformPicked(false)
                        setClaimedInfoId(null)
                        setError(null)
                        writePickParam(null)
                        if (name.trim()) searchCompanies(name)
                      }}>
                      {t("find_other_company")}
                    </button>
                  </div>
                  {fieldErrors.name && (
                    <p className="arco-small-text" style={{ marginTop: 4, color: "var(--destructive)" }}>{t("required_name")}</p>
                  )}
                </div>
              ) : (
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="cl-name"
                    style={fieldErrors.name ? { color: "var(--destructive)" } : undefined}>
                    {t("field_company")}
                  </label>
                  <input className={`${styles.input}${fieldErrors.name ? " input-error" : ""}`} id="cl-name" value={name}
                    onChange={(e) => { setName(e.target.value); setFieldErrors((f) => ({ ...f, name: undefined })) }} />
                  {fieldErrors.name && (
                    <p className="arco-small-text" style={{ marginTop: 4, color: "var(--destructive)" }}>{t("required_name")}</p>
                  )}
                  {/* The domain is the claim's proof anchor and the page's
                      external link — shown, never editable here. */}
                  {domain && (
                    <div className={styles.ok}><span>✓</span><span>{t("domain_verified_line", { domain })}</span></div>
                  )}
                </div>
              )}

              {(!isPlatform || platformPicked) && (<>
                {isPlatform && !ctx.company.domain && (
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="cl-website"
                      style={fieldErrors.website ? { color: "var(--destructive)" } : undefined}>
                      {t("field_website")}
                    </label>
                    <input className={`${styles.input}${fieldErrors.website ? " input-error" : ""}`}
                      id="cl-website" value={website} inputMode="url"
                      placeholder={t("website_placeholder")}
                      onChange={(e) => { setWebsite(e.target.value); setFieldErrors((f) => ({ ...f, website: undefined })) }} />
                    {fieldErrors.website && (
                      <p className="arco-small-text" style={{ marginTop: 4, color: "var(--destructive)" }}>{t("required_website")}</p>
                    )}
                  </div>
                )}

                {/* Platform: verification lives ON this step — a code
                    to an @domain mailbox proves the company before
                    anything is written. Success mints the claim token;
                    step 2 then runs codeless for this address. */}
                {isPlatform && (
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="cl-verify">{t("platform_verify_label")}</label>
                    <div className={styles.emailOuter}>
                      <input className={styles.input} id="cl-verify" value={verifyLocal}
                        style={{ maxWidth: 240 }}
                        autoComplete="off" inputMode="email" placeholder={t("verify_local_placeholder")}
                        disabled={platformCodeSent}
                        onChange={(e) => { setVerifyLocal(e.target.value.replace(/@.*$/, "")); setError(null) }} />
                      <span className={styles.emailSuffix}>@{domain || "…"}</span>
                    </div>
                    {platformCodeSent ? (
                      <>
                        <span className={styles.label} style={{ marginTop: 16 }}>
                          {t("platform_code_sent", { email: platformSentTo })}
                        </span>
                        {otpRow}
                        <div className={styles.note} style={{ marginTop: 10 }}>
                          <button type="button" className="arco-text-link"
                            onClick={() => { setPlatformCodeSent(false); setOtp(["", "", "", "", "", ""]) }}>
                            {t("resend_code")}
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className={styles.note}>{t("platform_verify_email_note")}</p>
                    )}
                  </div>
                )}

                {!isPlatform && (<>
                  <div className={styles.field}>
                    <span className={styles.label}
                      style={fieldErrors.address ? { color: "var(--destructive)" } : undefined}>
                      {t("field_location")}
                    </span>
                    {!editingAddress ? (
                      <div className={styles.addrShown}>
                        <span className={styles.addrText}>{displayAddress}</span>
                        <button type="button" className="arco-text-link"
                          onClick={() => setEditingAddress(true)}>
                          {t("change")}
                        </button>
                      </div>
                    ) : (
                      <>
                        <AddressLookup
                          placeholder={t("address_search_placeholder")}
                          autoFocus={Boolean(ctx.company.address)}
                          inputClassName={`${styles.input}${fieldErrors.address ? " input-error" : ""}`}
                          onResolved={(r) => { setLocation(r); setEditingAddress(false); setFieldErrors((f) => ({ ...f, address: undefined })) }}
                          onError={() => setError(t("address_error"))}
                        />
                        {(location || ctx.company.address) && (
                          <div className={styles.note} style={{ marginTop: 8 }}>
                            <button type="button" className="arco-text-link"
                              onClick={() => setEditingAddress(false)}>
                              {t("keep_address", { address: displayAddress })}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                    {fieldErrors.address && (
                      <p className="arco-small-text" style={{ marginTop: 4, color: "var(--destructive)" }}>{t("required_address")}</p>
                    )}
                  </div>

                  {/* Services — same design as the Selecteer-diensten popup:
                      ordered selected list (first = primary, draggable),
                      search, then category pills. */}
                  <div className={styles.field}>
                    <span className={styles.label}
                      style={fieldErrors.service ? { color: "var(--destructive)" } : undefined}>
                      {t("field_services")}
                    </span>
                    <p className={styles.note} style={{ margin: "0 0 14px" }}>{t("services_drag_hint")}</p>
                    <div className={styles.svcSelectedList}>
                      {serviceIds.length === 0 && (
                        <div className={styles.svcSelectedEmpty}
                          style={fieldErrors.service ? { color: "var(--destructive)" } : undefined}>
                          {t("services_empty")}
                        </div>
                      )}
                      {serviceIds.map((id, idx) => {
                        const s = serviceById.get(id)
                        if (!s) return null
                        return (
                          <div key={id}
                            className={`${styles.svcItem}${dragOver === idx ? ` ${styles.svcItemOver}` : ""}`}
                            draggable
                            onDragStart={() => { dragFrom.current = idx }}
                            onDragOver={(e) => { e.preventDefault(); setDragOver(idx) }}
                            onDragLeave={() => setDragOver((d) => (d === idx ? null : d))}
                            onDrop={(e) => {
                              e.preventDefault(); setDragOver(null)
                              const from = dragFrom.current
                              if (from === null || from === idx) return
                              setServiceIds((prev) => {
                                const next = [...prev]
                                const [moved] = next.splice(from, 1)
                                next.splice(idx, 0, moved)
                                return next
                              })
                              dragFrom.current = null
                            }}
                            onDragEnd={() => { setDragOver(null); dragFrom.current = null }}>
                            <span className={styles.svcGrip}>
                              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><circle cx="5" cy="4" r="1.2"/><circle cx="11" cy="4" r="1.2"/><circle cx="5" cy="8" r="1.2"/><circle cx="11" cy="8" r="1.2"/><circle cx="5" cy="12" r="1.2"/><circle cx="11" cy="12" r="1.2"/></svg>
                            </span>
                            {idx === 0 && <span className={styles.svcPrimaryBadge}>{t("primary")}</span>}
                            <span className={styles.svcItemName}>{svcLabel(s)}</span>
                            <button type="button" className={styles.svcRemove} aria-label={t("remove")}
                              onClick={() => toggleService(id)}>×</button>
                          </div>
                        )
                      })}
                    </div>
                    {/* One dropdown per category; the primary service's own
                        category starts open, the rest are a click away. */}
                    {ctx.taxonomy.map((g) => {
                      const selectedInGroup = g.services.filter((s) => serviceIds.includes(s.id)).length
                      return (
                        <details key={g.id} className={styles.svcGroup} open={g.id === myGroup?.id}>
                          <summary className={styles.svcGroupSummary}>
                            <span>{groupLabel(g)}</span>
                            {selectedInGroup > 0 && (
                              <span className="filter-pill-badge">{selectedInGroup}</span>
                            )}
                            <span className={styles.svcGroupChevron} aria-hidden>
                              <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </span>
                          </summary>
                          <div className={styles.pills} style={{ padding: "4px 0 11px" }}>
                            {g.services.map((s) => {
                              const on = serviceIds.includes(s.id)
                              return (
                                <button key={s.id} type="button"
                                  className={`${styles.pill}${on ? ` ${styles.pillOn}` : ""}`}
                                  onClick={() => toggleService(s.id)}>
                                  {on ? "✓ " : ""}{svcLabel(s)}
                                </button>
                              )
                            })}
                          </div>
                        </details>
                      )
                    })}
                  </div>

                </>)}


                {error && <p className={styles.error} style={{ whiteSpace: "pre-line" }}>{error}</p>}

                <div className={styles.ctaBar}><div className={styles.ctaBarInner}>
                  {isPlatform ? (
                    platformCodeSent ? (
                      <button className="landing-cta" disabled={busy || otp.join("").length !== 6} onClick={verifyPlatformCode}>
                        {busy ? t("saving") : t("verify_continue")}
                      </button>
                    ) : (
                      <button className="landing-cta" disabled={busy} onClick={sendPlatformCode}>
                        {busy ? t("sending") : t("send_verify_code")}
                      </button>
                    )
                  ) : (
                    <button className="landing-cta" disabled={busy} onClick={submitCompany}>
                      {busy ? t("saving") : t("continue")}
                    </button>
                  )}
                  {!isPlatform && (
                    <span className={styles.ctaNote}>{t(channel === "showcase" ? "showcase_write_note" : "company_write_note")}</span>
                  )}
                </div></div>
              </>)}
            </div>

            <aside className={styles.side}>
              {channel === "invite" ? (<>{projectCard}{rosterCard}</>) : proCardPreview}
            </aside>
          </div>
        </div></div>
      </>
    )
  }

  /* ── screen 2 · you ──────────────────────────────────────────────
     Four ways to be a person here:
       A. already signed in            → publish as that account, or switch
       B. no session, keep invited     → account created at publish, no code
       C. no session, different email  → one code (signUpWithOtp handles
                                          both new and existing addresses)
       D. no session, existing account → same code UI, entered via the
                                          "already have an account" link or
                                          the existing_account response   */
  return (
    <>
      {header}
      <div className={styles.body}><div className={styles.wrap}>
        <div className={styles.grid}>
          <div className={`${styles.intro} ${styles.introArea}`} style={{ position: "relative" }}>
            {/* Absoluut in de toppadding van de body geplaatst, zodat de
                H1 op exact dezelfde hoogte staat als op stap 1. */}
            <p style={{ position: "absolute", top: -40, left: 0, margin: 0 }}>
              <button type="button" className="arco-text-link" onClick={() => { setScreen("company"); setError(null); writeStepParam(false) }}>
                ‹ {t("back_to_company")}
              </button>
            </p>
            <h1 className={`arco-page-title ${styles.display}`}>{t("you_title")}</h1>
            <p className={`arco-body-text ${styles.lede}`}>{t("you_lede", { company: name })}</p>
          </div>

          <div className={styles.mainArea} style={{ maxWidth: 460 }}>
            {session ? (
              /* Signed in — the account is settled; publishing is all
                 that is left. Platform: only if the account e-mail sits
                 on the company domain — that match IS the proof. */
              <>
                <div className={styles.field}>
                  <span className={styles.label}>{t("claim_as")}</span>
                  <div className={styles.sessionCard}>
                    <span className={styles.sessionAvatar}>
                      {session.avatarUrl
                        ? <img src={session.avatarUrl} alt="" referrerPolicy="no-referrer" />
                        : <span>{session.name.charAt(0).toUpperCase()}</span>}
                    </span>
                    <span>
                      <span className={styles.sessionName}>{session.name}</span>
                      <span className={styles.sessionEmail}>{session.email}</span>
                    </span>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <button type="button" className="arco-text-link" onClick={switchAccount}>
                      {t("use_other_account")}
                    </button>
                  </div>
                </div>
                {error && <p className={styles.error} style={{ marginBottom: 12 }}>{error}</p>}
                <button className="landing-cta" style={{ width: "100%" }}
                  disabled={busy} onClick={publishSignedIn}>
                  {busy ? t("publishing") : t(channel === "showcase" ? "claim_cta" : "publish_cta")}
                </button>
                <p className={styles.finePrint} style={{ textAlign: "center", maxWidth: "none", marginTop: 18 }}>
                  {termsRich("terms_note_signed")}
                </p>
              </>
            ) : (
              /* The login modal's own layout, inline: email + continue,
                 "of", Google, terms. The one path the modal cannot do —
                 the invited address without an account — stays here and
                 needs no code; the rest routes through the modal. */
              <>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="cl-login">{t("email_label")}</label>
                  <div className={styles.inputWithAction}>
                    <input className={`${styles.input}${namesMode || otpSent ? ` ${styles.inputActionPadSm}` : ""}`}
                      id="cl-login" type="email" value={emailValue}
                      disabled={namesMode || otpSent}
                      onChange={(e) => onEmailEdited(e.target.value)} />
                    {(namesMode || otpSent) && (
                      <button type="button" className={`arco-text-link ${styles.inputAction}`}
                        onClick={() => onEmailEdited(email)}>
                        {t("change")}
                      </button>
                    )}
                  </div>
                  {/* Announced only when the address actually differs
                      from the proven one — and gone again once a code
                      is on its way. */}
                  {email && emailValue.trim() && !otpSent
                    && emailValue.trim().toLowerCase() !== email.toLowerCase() && (
                    <p className={styles.note}>{t("other_address_note")}</p>
                  )}
                  {existsFlow && otpSent && (
                    <p className={styles.note}>{t("code_sent_note", { email: emailValue.trim() })}</p>
                  )}

                </div>

                {namesMode && (
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <div className={styles.field} style={{ flex: "1 1 180px" }}>
                      <label className={styles.label} htmlFor="cl-first">{t("first_name_label")}</label>
                      <input className={styles.input} id="cl-first" value={firstName} autoFocus
                        autoComplete="given-name" placeholder={t("first_name_placeholder")}
                        onChange={(e) => setFirstName(e.target.value)} />
                    </div>
                    <div className={styles.field} style={{ flex: "1 1 180px" }}>
                      <label className={styles.label} htmlFor="cl-last">{t("last_name_label")}</label>
                      <input className={styles.input} id="cl-last" value={lastName}
                        autoComplete="family-name" placeholder={t("last_name_placeholder")}
                        onChange={(e) => setLastName(e.target.value)} />
                    </div>
                  </div>
                )}

                {otpSent && (
                  <div className={styles.field}>
                    <span className={styles.label}>{t("platform_code_sent", { email: emailValue.trim() })}</span>
                    {otpRow}
                  </div>
                )}

                {error && <p className={styles.error} style={{ marginBottom: 12 }}>{error}</p>}

                {otpSent ? (
                  <button className="landing-cta" style={{ width: "100%" }}
                    disabled={busy || otp.join("").length !== 6} onClick={verifyOtpCode}>
                    {busy ? t("publishing") : t("verify_and_publish")}
                  </button>
                ) : !namesMode ? (
                  <button className="landing-cta" style={{ width: "100%" }}
                    disabled={busy} onClick={gaVerder}>
                    {busy ? t("sending") : t("continue_email")}
                  </button>
                ) : isInvited ? (
                  <button className="landing-cta" style={{ width: "100%" }}
                    disabled={busy || !firstName.trim()} onClick={submitComplete}>
                    {busy ? t("publishing") : t(channel === "showcase" ? "claim_cta" : "publish_cta")}
                  </button>
                ) : (
                  <button className="landing-cta" style={{ width: "100%" }}
                    disabled={busy || !firstName.trim()} onClick={sendSignupCode}>
                    {busy ? t("sending") : t("send_code")}
                  </button>
                )}

                <div className="auth-divider">{t("or")}</div>

                <button type="button" className="btn-tertiary" onClick={continueWithGoogle}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontSize: 14, padding: "12px 20px" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  {t("continue_google")}
                </button>

                <p className={styles.finePrint} style={{ textAlign: "center", maxWidth: "none", marginTop: 18 }}>
                  {termsRich("terms_note")}
                </p>
              </>
            )}
          </div>

          <aside className={styles.side}>
            {channel === "invite" ? (<>{projectCard}{rosterCard}</>) : proCardPreview}
          </aside>
        </div>
      </div></div>
    </>
  )
}
