"use client"

/**
 * Kruisje naast de waarde van een veld in de detailsbalk van de
 * projecteditor. Verschijnt bij hover op de cel (op touch altijd), staat
 * rechts van de tekst zonder die uit het midden te duwen, en verdwijnt
 * zodra de cel bewerkt wordt. Stijl in globals.css (.spec-value,
 * .spec-clear).
 *
 * Gebruik:
 *   <div className="arco-card-title">
 *     <span className="spec-value">{label}<SpecClearButton … /></span>
 *   </div>
 */
export function SpecClearButton({
  onClear,
  label,
  disabled,
}: {
  onClear: () => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className="spec-clear"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onClear()
      }}
    >
      <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
        <path d="M2 2l6 6M8 2l-6 6" />
      </svg>
    </button>
  )
}
