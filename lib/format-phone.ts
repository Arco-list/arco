/** Dutch phone display formatting: +31 (0)6 1234 5678 for mobile,
 * +31 (0)20 123 4567 / +31 (0)184 69 21 71 for landlines. Non-Dutch or
 * non-standard numbers are returned untouched. */

const TWO_DIGIT_AREAS = new Set([
  "10", "13", "15", "20", "23", "24", "26", "30", "33", "35", "36", "38",
  "40", "43", "45", "46", "50", "53", "55", "58", "70", "71", "72", "73",
  "74", "75", "76", "77", "78", "79",
])

export function formatPhoneDisplay(raw: string | null): string | null {
  if (!raw) return raw
  let digits = raw.replace(/\D/g, "")
  // Foreign country code -> leave as entered.
  if (raw.trim().startsWith("+") && !digits.startsWith("31")) return raw
  if (digits.startsWith("0031")) digits = digits.slice(4)
  else if (digits.startsWith("31") && digits.length >= 11) digits = digits.slice(2)
  const national = digits.startsWith("0") ? digits.slice(1) : digits
  if (national.length !== 9) return raw
  if (national.startsWith("6")) {
    return `+31 (0)6 ${national.slice(1, 5)} ${national.slice(5)}`
  }
  const area2 = national.slice(0, 2)
  if (TWO_DIGIT_AREAS.has(area2)) {
    const rest = national.slice(2)
    return `+31 (0)${area2} ${rest.slice(0, 3)} ${rest.slice(3)}`
  }
  const area3 = national.slice(0, 3)
  const rest = national.slice(3)
  return `+31 (0)${area3} ${rest.slice(0, 2)} ${rest.slice(2, 4)} ${rest.slice(4)}`
}
