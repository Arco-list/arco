"use client"

/**
 * Finding a company by name.
 *
 * A field, and under it the matches as rows you can press — the same
 * control in the claim funnel (where the match becomes the page you are
 * claiming) and in the add-professional dialog on a project (where it
 * becomes a credit). Both were drawing it themselves, with two sets of
 * row styles that had already drifted apart on the badge and the city.
 *
 * Rows rather than a dropdown, deliberately: the list is the point
 * here. It stays put while you read it, and a row has room for the two
 * things that tell companies apart — whether Arco already knows them,
 * and where they sit.
 *
 * Styles live in globals.css (.company-lookup*); see /design → Form
 * Elements → Company lookup.
 */

export type CompanyLookupResult = {
  /** Stable id for React and for onSelect. */
  key: string
  name: string
  city?: string | null
  /** "Op Arco" (solid primary — we already know them) or "Claim" (teal
   *  tint — free to take). Omit for a result we have never seen. */
  badge?: { label: string; tone?: "claim" | "on-arco" | "neutral" } | null
  /**
   * Starts a new group, under a hairline: rows that came from somewhere
   * else (Google Places) rather than from Arco.
   */
  separated?: boolean
  /** Shown under the row while it is the expanded one. */
  note?: string | null
  disabled?: boolean
}

export function CompanyLookup({
  label,
  inputId,
  value,
  onChange,
  placeholder,
  autoFocus = false,
  results,
  onSelect,
  expandedKey = null,
  disabled = false,
  busyLabel = null,
  hint = null,
  error = null,
  inputClassName = "form-input",
}: {
  label?: string | null
  inputId: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoFocus?: boolean
  results: CompanyLookupResult[]
  onSelect: (key: string) => void
  /** Which row is showing its note — the caller owns that state, since
   *  what a press means differs per screen. */
  expandedKey?: string | null
  /** Rows go quiet while a pick is being resolved. */
  disabled?: boolean
  /** Rendered as a last row while more results are on their way. */
  busyLabel?: string | null
  /** The line under the list: what to do when nothing matches. A node,
   *  so a screen that offers a way out can put a link in the sentence. */
  hint?: React.ReactNode
  error?: string | null
  /** Escape hatch for a screen with its own field treatment; both
   *  callers use the default. */
  inputClassName?: string
}) {
  return (
    <>
      {label && (
        <label className="form-label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`${inputClassName} company-lookup-field`}
        value={value}
        autoFocus={autoFocus}
        autoComplete="off"
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />

      {(results.length > 0 || busyLabel) && (
        <div className="company-lookup-rows">
          {results.map((result, index) => (
            <div
              key={result.key}
              className={result.separated && index > 0 ? "company-lookup-row-group" : undefined}
            >
              <button
                type="button"
                className="company-lookup-row"
                disabled={disabled || result.disabled}
                onClick={() => onSelect(result.key)}
              >
                <span className="company-lookup-label">
                  <span className="company-lookup-name">{result.name}</span>
                  {result.badge && (
                    <span
                      className={`company-lookup-badge${result.badge.tone ? ` company-lookup-badge--${result.badge.tone}` : ""}`}
                    >
                      {result.badge.label}
                    </span>
                  )}
                </span>
                <span className="company-lookup-meta">{result.city ?? ""}</span>
              </button>
              {result.note && expandedKey === result.key && (
                <p className="form-note" style={{ margin: "8px 2px 4px" }}>
                  {result.note}
                </p>
              )}
            </div>
          ))}
          {busyLabel && (
            <div className="company-lookup-row" style={{ color: "var(--arco-mid-grey)", cursor: "default" }}>
              {busyLabel}
            </div>
          )}
        </div>
      )}

      {error && <p className="form-note form-note--error">{error}</p>}
      {hint && <p className="company-lookup-hint">{hint}</p>}
    </>
  )
}
