/**
 * Openingstijden van een vestiging, zoals Google ze aanlevert
 * (weekday_text, Engels, 12-uurs):
 *
 *   Monday: Closed
 *   Tuesday: 9:30 AM – 5:30 PM
 *   Saturday: 9:00 AM – 12:30 PM, 1:30 – 5:00 PM
 *
 * omgezet naar een week in 24-uurs tijden, met gelijke opeenvolgende dagen
 * samengevoegd ("Di – vr  9:30 – 17:30") en of de vestiging nu open is.
 * Wat we niet kunnen lezen tonen we ongewijzigd (parse geeft null).
 */

const DAYS_EN = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
const DAYS_NL_FULL = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"]
const DAY_LABEL = {
  nl: ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
}

/** Minuten na middernacht, per dag (0 = maandag) een lijst [open, dicht]. */
export type WeekHours = Array<Array<[number, number]> | "closed" | "24h">

function toMinutes(t: string, meridiem: string | null): number | null {
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?$/)
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2] ?? 0)
  if (meridiem) {
    const pm = meridiem.toLowerCase() === "pm"
    if (h === 12) h = pm ? 12 : 0
    else if (pm) h += 12
  }
  return h * 60 + min
}

function parseRange(range: string): [number, number] | null {
  // "9:30 AM – 5:30 PM", "1:30 – 5:00 PM" (Google laat de eerste AM/PM weg
  // als die gelijk is), of al 24-uurs "09:30–17:30".
  const parts = range.split(/\s*[–—-]\s*/)
  if (parts.length !== 2) return null
  const re = /^(\d{1,2}(?::\d{2})?)\s*([AaPp][Mm])?$/
  const a = parts[0].trim().match(re)
  const b = parts[1].trim().match(re)
  if (!a || !b) return null
  const from = toMinutes(a[1], a[2] ?? b[2] ?? null)
  let to = toMinutes(b[1], b[2] ?? null)
  if (from == null || to == null) return null
  if (to <= from) to += 24 * 60 // tot na middernacht
  return [from, to]
}

export function parseOpeningHours(text: string | null | undefined): WeekHours | null {
  if (!text) return null
  const week: WeekHours = new Array(7).fill(null)
  for (const raw of text.split(/\n+/)) {
    const line = raw.replace(/[   ]/g, " ").trim()
    if (!line) continue
    const m = line.match(/^([A-Za-zé]+)\s*:\s*(.+)$/)
    if (!m) return null
    const key = m[1].toLowerCase()
    let day = DAYS_EN.indexOf(key)
    if (day === -1) day = DAYS_NL_FULL.indexOf(key)
    if (day === -1) return null
    const value = m[2].trim()
    if (/^(closed|gesloten)$/i.test(value)) { week[day] = "closed"; continue }
    if (/open 24 hours|24 uur geopend/i.test(value)) { week[day] = "24h"; continue }
    const ranges = value.split(/\s*,\s*/).map(parseRange)
    if (ranges.some((r) => r == null)) return null
    week[day] = ranges as Array<[number, number]>
  }
  return week.every((d) => d != null) ? week : null
}

function fmt(min: number): string {
  const m = min % (24 * 60)
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`
}

function dayText(d: WeekHours[number], locale: string): string {
  if (d === "closed") return locale === "nl" ? "Gesloten" : "Closed"
  if (d === "24h") return locale === "nl" ? "24 uur open" : "Open 24 hours"
  return d.map(([a, b]) => `${fmt(a)} – ${fmt(b)}`).join(", ")
}

/** Opeenvolgende dagen met dezelfde tijden samen: "Di – vr" + "9:30 – 17:30". */
export function groupWeek(week: WeekHours, locale: string): Array<{ days: string; hours: string; from: number; to: number; closed: boolean }> {
  const labels = locale === "nl" ? DAY_LABEL.nl : DAY_LABEL.en
  const out: Array<{ days: string; hours: string; from: number; to: number; closed: boolean }> = []
  for (let i = 0; i < 7; i++) {
    const text = dayText(week[i], locale)
    const last = out[out.length - 1]
    if (last && last.hours === text && last.to === i - 1) {
      last.to = i
      last.days = `${labels[last.from]} – ${locale === "nl" ? labels[i].toLowerCase() : labels[i]}`
    } else {
      out.push({ days: labels[i], hours: text, from: i, to: i, closed: week[i] === "closed" })
    }
  }
  return out
}

/** Nu open? Op Nederlandse tijd, want daar staan de vestigingen. */
export function openStatus(week: WeekHours, locale: string, now = new Date()): { open: boolean; text: string; today: number } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now)
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon"
  const today = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(wd)
  const minutes = Number(parts.find((p) => p.type === "hour")?.value ?? 0) * 60 + Number(parts.find((p) => p.type === "minute")?.value ?? 0)
  const nl = locale === "nl"
  const labels = nl ? DAY_LABEL.nl : DAY_LABEL.en

  const d = week[today]
  if (d === "24h") return { open: true, text: nl ? "Nu open" : "Open now", today }
  if (Array.isArray(d)) {
    const cur = d.find(([a, b]) => minutes >= a && minutes < b)
    if (cur) return { open: true, text: nl ? `Nu open · tot ${fmt(cur[1])}` : `Open now · until ${fmt(cur[1])}`, today }
    const later = d.find(([a]) => a > minutes)
    if (later) return { open: false, text: nl ? `Gesloten · opent om ${fmt(later[0])}` : `Closed · opens at ${fmt(later[0])}`, today }
  }
  for (let k = 1; k <= 7; k++) {
    const idx = (today + k) % 7
    const n = week[idx]
    if (n === "24h" || Array.isArray(n)) {
      const at = n === "24h" ? "0:00" : fmt(n[0][0])
      const when = k === 1 ? (nl ? "morgen" : "tomorrow") : labels[idx].toLowerCase()
      return { open: false, text: nl ? `Gesloten · opent ${when} om ${at}` : `Closed · opens ${when} at ${at}`, today }
    }
  }
  return { open: false, text: nl ? "Gesloten" : "Closed", today }
}
