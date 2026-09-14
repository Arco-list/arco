"use client"

/**
 * The account-page toggle (44×24, teal when on) as a shared component —
 * same look as the notification preferences switch on /homeowner, plus
 * a disabled state for read-only viewers.
 */
export const ToggleSwitch = ({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean
  onChange: () => void
  disabled?: boolean
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={disabled ? undefined : onChange}
    style={{
      width: 44, height: 24, borderRadius: 12, border: "none",
      cursor: disabled ? "default" : "pointer",
      background: checked ? "#016D75" : "#d4d4d2",
      opacity: disabled ? 0.5 : 1,
      position: "relative", transition: "background .2s", flexShrink: 0,
    }}
  >
    <span style={{
      position: "absolute", top: 2, left: checked ? 22 : 2,
      width: 20, height: 20, borderRadius: "50%", background: "#fff",
      transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)",
    }} />
  </button>
)
