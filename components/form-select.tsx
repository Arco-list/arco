"use client"

import type { CSSProperties, SelectHTMLAttributes } from "react"
import { ChevronDown } from "lucide-react"

/**
 * A <select> dressed like the rest of the form.
 *
 * The chevron is a real element rather than a background image on the
 * select. A data URI has to survive a CSS parser, a bundler and a
 * browser's data-URL rules before it draws anything, and when it fails
 * it fails silently — `appearance: none` has already removed the
 * platform's own arrow by then, leaving a dropdown with no sign that it
 * opens. An icon node either renders or throws.
 *
 * It also follows the ink: the mark inherits a token colour instead of
 * a hex baked into an encoded string.
 */
export function FormSelect({
  className,
  wrapStyle,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { wrapStyle?: CSSProperties }) {
  return (
    <div className="form-select-wrap" style={wrapStyle}>
      <select {...props} className={`form-input form-select${className ? ` ${className}` : ""}`}>
        {children}
      </select>
      <ChevronDown size={14} strokeWidth={1.75} className="form-select-chevron" aria-hidden="true" />
    </div>
  )
}
