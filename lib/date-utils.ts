/**
 * Date helpers used by server-side scheduling code (e.g. the drip queue).
 *
 * Kept in plain Node-friendly TypeScript with no external dependencies so it
 * can be imported from anywhere on the server side. We rely on the runtime
 * Intl API for timezone math instead of pulling in date-fns-tz / luxon.
 */

const AMSTERDAM_TZ = "Europe/Amsterdam"
const BUSINESS_START_HOUR = 9 // 09:00 local
const BUSINESS_END_HOUR = 17 // 17:00 local (exclusive — last valid send minute is 16:59)

/**
 * Returns a UTC `Date` representing the next valid "business slot" `days`
 * business days from now, clamped to a 09:00–17:00 Europe/Amsterdam window.
 *
 * Behaviour, in order:
 *   1. Start from `now` in Europe/Amsterdam local time.
 *   2. Walk forward `days` business days, skipping Saturday and Sunday.
 *      A Friday + 1 business day = next Monday.
 *   3. If the resulting time is before 09:00, snap to 09:00 same day.
 *   4. If the resulting time is at or after 17:00, snap to 09:00 the
 *      next business day.
 *   5. If the resulting day lands on a weekend (e.g. because someone
 *      passed `days = 0` on a Saturday morning), snap to 09:00 the next
 *      business day.
 *
 * Returns the slot as a `Date` (always in UTC under the hood — JS Date
 * objects don't carry timezones; we just compute the right UTC instant
 * that represents 09:00:00.000 local Amsterdam time on the target day).
 *
 * Why business hours: outreach sequences should land in inboxes when
 * recipients are likely awake and at work. A Friday 16:00 intro followed
 * by a Saturday morning followup is the kind of thing that gets us flagged
 * as spam by serious filters; landing in the Monday morning inbox instead
 * is dramatically more polite.
 *
 * Why Europe/Amsterdam specifically: Arco is a Dutch marketplace targeting
 * Dutch and Belgian architects. If we expand to other regions later we'll
 * want to make this per-recipient, but for now hardcoding the sender's
 * working hours is correct.
 */
export function nextBusinessSlot(days: number, now: Date = new Date()): Date {
  // Step 1: extract Amsterdam-local Y/M/D/H from `now` so we can do the
  // weekday + business-hours math in local terms.
  let local = toAmsterdamParts(now)

  // Step 2: walk `days` business days forward. We start from "today" so
  // `days = 0` means "today's next valid slot or push to next business day".
  let businessDaysAdded = 0
  while (businessDaysAdded < days) {
    local = addOneCalendarDay(local)
    if (!isWeekend(local)) {
      businessDaysAdded++
    }
  }

  // Step 3-5: clamp to business hours, snapping forward if needed.
  // Loop because snapping forward to "next business day at 09:00" may
  // itself land on a weekend (e.g. computed Friday end-of-day → Saturday).
  // The loop normally runs at most twice.
  while (true) {
    if (isWeekend(local)) {
      local = addOneCalendarDay(local)
      local.hour = BUSINESS_START_HOUR
      local.minute = 0
      local.second = 0
      local.millisecond = 0
      continue
    }
    if (local.hour < BUSINESS_START_HOUR) {
      local.hour = BUSINESS_START_HOUR
      local.minute = 0
      local.second = 0
      local.millisecond = 0
      break
    }
    if (local.hour >= BUSINESS_END_HOUR) {
      local = addOneCalendarDay(local)
      local.hour = BUSINESS_START_HOUR
      local.minute = 0
      local.second = 0
      local.millisecond = 0
      continue
    }
    break
  }

  return amsterdamPartsToUtc(local)
}

// ── Internal: timezone math without external deps ──────────────────────────
//
// JS Date doesn't store a timezone — it's an instant in UTC plus a string
// converter. To do "what hour is it in Amsterdam right now", we use Intl
// .DateTimeFormat to format a UTC instant into Amsterdam local fields, and
// then to go the other way we binary-search for the UTC instant whose local
// representation matches the fields we want. The binary search is needed
// because Amsterdam crosses DST twice a year and there's no closed-form
// inverse without dragging in a tz library.

type LocalParts = {
  year: number
  month: number // 1-12
  day: number
  hour: number
  minute: number
  second: number
  millisecond: number
  weekday: number // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
}

function toAmsterdamParts(date: Date): LocalParts {
  // Formatter that returns the date's representation in Amsterdam local time.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: AMSTERDAM_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hour12: false,
  })
  const parts = fmt.formatToParts(date)
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "0"

  // Map 3-letter weekday → 0..6 (Sunday-first)
  const wdMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  }

  return {
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10),
    day: parseInt(get("day"), 10),
    // `hour: "2-digit"` with hour12:false returns "24" at midnight on some
    // engines and "00" on others — normalise.
    hour: parseInt(get("hour"), 10) % 24,
    minute: parseInt(get("minute"), 10),
    second: parseInt(get("second"), 10),
    millisecond: date.getUTCMilliseconds(),
    weekday: wdMap[get("weekday")] ?? 0,
  }
}

function addOneCalendarDay(parts: LocalParts): LocalParts {
  // Use a UTC Date to do the day math then convert back to local. This
  // sidesteps DST edge cases — we're not crossing midnight in local time,
  // we're rolling forward exactly one calendar day.
  const utc = Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0)
  const next = new Date(utc + 24 * 60 * 60 * 1000)
  // Re-extract the local parts because the local weekday changed.
  const localFromNext = toAmsterdamParts(next)
  // Preserve the time-of-day fields from the input — we only wanted the
  // calendar to advance, not the wall-clock time. (The calling code
  // overrides hour/minute/second after if it cares.)
  return {
    ...localFromNext,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
    millisecond: parts.millisecond,
  }
}

function isWeekend(parts: LocalParts): boolean {
  return parts.weekday === 0 || parts.weekday === 6
}

/**
 * Convert (year, month, day, hour, minute, second, millisecond) interpreted
 * as Europe/Amsterdam local time into the UTC `Date` representing that
 * instant. Uses a small two-step correction: pretend it's UTC, ask Intl
 * what that UTC instant looks like in Amsterdam, compute the offset, apply.
 * One iteration is enough except in the brief overlap window during the
 * autumn DST transition, but for our purposes (scheduling drips at 09:00)
 * the worst-case error is a 1-hour offset on a single day per year, which
 * doesn't matter.
 */
function amsterdamPartsToUtc(parts: LocalParts): Date {
  // Naive UTC: if Amsterdam *were* UTC, this is when the slot would be.
  const naiveUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  )
  // Compute the actual Amsterdam offset for that instant (in minutes east).
  const tzOffsetMinutes = getAmsterdamUtcOffsetMinutes(new Date(naiveUtc))
  // Subtract the offset to get the true UTC instant.
  return new Date(naiveUtc - tzOffsetMinutes * 60 * 1000)
}

/**
 * How many minutes is Amsterdam ahead of UTC at the given instant?
 * +60 in winter (CET), +120 in summer (CEST).
 */
function getAmsterdamUtcOffsetMinutes(date: Date): number {
  // Format the date in Amsterdam, then compare to the UTC representation
  // of the same instant. Difference = offset.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: AMSTERDAM_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
  const parts = fmt.formatToParts(date)
  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10)
  const local = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
    0,
  )
  return Math.round((local - date.getTime()) / 60000)
}
