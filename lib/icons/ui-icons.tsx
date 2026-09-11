"use client"

import type { CSSProperties, ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

/**
 * Arco's hand-drawn UI icons — the interface set (nav, menus, cards)
 * in the same flowing one-pen hand as the service marks in
 * custom-service-icons.tsx, but tuned for symbol duty:
 *
 *   - they render at 16–22px, so the wobble is subtler: gently bowed
 *     lines and near-miss closures, no big curls;
 *   - they fill the canvas like lucide does (content ~4→20 of 24), so
 *     they can drop in one-for-one where lucide icons render today;
 *   - same prop surface as lucide (size / strokeWidth / style /
 *     className), stroke 1.75 default to match lucide's optical weight
 *     at small sizes.
 *
 * Preview + iteration happens on /admin/design under "Icons".
 */

type IconProps = {
  size?: number | string
  strokeWidth?: number | string
  style?: CSSProperties
  className?: string
}

const icon = (children: ReactNode) =>
  (({ size = 24, strokeWidth = 1.75, style, className }: IconProps) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  )) as unknown as LucideIcon

/** Home — the one-pen house: walls, roof and floor in one stroke, the
 *  doorway an arch dipping through it. Replaces lucide House. */
export const UiHomeIcon = icon(
  <>
      <path d="M4.6 19.3C4.5 16.5 4.5 13.7 4.8 11.2L12 4.6L19.2 11.2C19.5 13.7 19.5 16.6 19.4 19.2C14.5 19.6 9.5 19.6 4.4 19.1" />
      <path d="M10.2 19.4C10.1 17.7 10.2 16.2 10.7 15.4C11.4 14.2 12.8 14.3 13.4 15.5C13.8 16.4 13.8 17.9 13.7 19.6" />
  </>,
)

/** Users — two figures, heads as near-closed loops. Replaces lucide Users. */
export const UiUsersIcon = icon(
  <>
      <path d="M9.7 6.4C11.2 6.5 12.2 7.7 12 9.2C11.8 10.6 10.4 11.5 9 11.1C7.8 10.7 7.1 9.4 7.6 8.2C7.9 7.3 8.7 6.7 9.6 6.6" />
      <path d="M4.4 17.6C4.7 14.3 6.9 12.3 9.8 12.3C12.7 12.3 14.9 14.2 15.3 17.4" />
      <path d="M14.9 6.9C16.5 6.5 18.1 7.5 18.4 9.1C18.6 10.1 18.2 11 17.5 11.6" />
      <path d="M16.8 12.8C18.7 13.5 19.8 15.1 20 17.3" />
  </>,
)

/** Mail — envelope as a near-closed loop, the flap one V-sweep.
 *  Replaces lucide Mail. */
export const UiMailIcon = icon(
  <>
      <path d="M3.9 7.4C3.7 10.5 3.7 13.7 4 16.7C9.3 17 14.7 17 19.9 16.7C20.2 13.6 20.2 10.4 20 7.5C14.7 7.1 9.3 7.1 3.6 7.6" />
      <path d="M4.3 8C6.9 10.1 9.4 12.1 12 14C14.6 12 17.2 10 19.7 8.1" />
  </>,
)

/** Heart — one stroke, ending in a near-miss at the point.
 *  Replaces lucide Heart. */
export const UiHeartIcon = icon(
  <>
      <path d="M12 19.2C8.7 16.6 5.9 14 4.7 11.2C3.6 8.6 5.2 5.9 7.9 5.8C9.6 5.7 11.1 6.7 12 8.3C12.9 6.7 14.4 5.7 16.1 5.8C18.8 5.9 20.4 8.6 19.3 11.2C18.1 14 15.2 16.7 12.2 19.4" />
  </>,
)

/** Bookmark — one stroke down, into the notch and back up to a
 *  near-miss. Replaces lucide Bookmark. */
export const UiBookmarkIcon = icon(
  <>
      <path d="M6.6 4.9C10.2 4.6 13.9 4.6 17.4 4.9C17.7 9.7 17.7 14.5 17.5 19.3C15.6 17.6 13.8 16 12 14.5C10.2 16 8.5 17.6 6.7 19.2C6.4 14.4 6.4 9.7 6.6 5.1" />
  </>,
)

/** Settings — a gear as a near-closed hub with six loose teeth.
 *  Replaces lucide Settings. */
export const UiSettingsIcon = icon(
  <>
      <path d="M12 8.9C13.8 9 15.1 10.4 15 12.1C14.9 13.9 13.4 15.2 11.7 15C10 14.8 8.8 13.3 9.1 11.6C9.3 10.2 10.5 9.1 11.9 9" />
      <path d="M12 4.9c0 .7 0 1.4.1 2.1" />
      <path d="M12 17c0 .7 0 1.4.1 2.1" />
      <path d="M5.8 8.4c.6.4 1.2.7 1.9 1.1" />
      <path d="M16.3 14.5c.6.4 1.2.7 1.9 1.1" />
      <path d="M5.8 15.6c.6-.4 1.2-.7 1.9-1.1" />
      <path d="M16.3 9.5c.6-.4 1.2-.7 1.9-1.1" />
  </>,
)

/** Help — a near-closed circle around a flowing question mark.
 *  Replaces lucide HelpCircle. */
export const UiHelpIcon = icon(
  <>
      <path d="M11.9 4.9C15.8 4.8 18.9 7.9 19 11.8C19.1 15.7 16 18.9 12.1 19C8.2 19.1 5.1 16 5 12.2C4.9 8.3 7.9 5.2 11.7 5" />
      <path d="M9.7 9.9C9.8 8.6 10.8 7.8 12.1 7.9C13.4 8 14.3 9 14.2 10.2C14.1 11.2 13.4 11.8 12.4 12.2C12 12.4 11.9 12.8 11.9 13.4" />
      <path d="M11.9 15.7c0 .2 0 .4.1.6" />
  </>,
)

/** Sign out — the door frame open at the right, the arrow leaving
 *  through it. Replaces lucide LogOut. */
export const UiSignOutIcon = icon(
  <>
      <path d="M13.5 4.8C11 4.6 8.5 4.6 6.1 4.9C5.8 9.7 5.8 14.4 6.1 19.1C8.5 19.4 11 19.4 13.4 19.2" />
      <path d="M10.9 12.1c2.9.1 5.8.1 8.7 0" />
      <path d="M17.2 9.6c1 .7 1.9 1.6 2.7 2.5-.9.9-1.8 1.7-2.8 2.4" />
  </>,
)

/** Search — a near-closed lens, the handle a single flick.
 *  Replaces lucide Search. */
export const UiSearchIcon = icon(
  <>
      <path d="M10.4 4.9C13.8 5 16.3 7.7 16.1 11C15.9 14.3 13.1 16.7 9.9 16.4C6.8 16.1 4.6 13.4 4.9 10.3C5.2 7.4 7.5 5.2 10.3 5" />
      <path d="M15.6 15.5c1.4 1.3 2.7 2.6 3.9 4" />
  </>,
)

/** Close — two gently bowed strokes crossing. Replaces lucide X. */
export const UiCloseIcon = icon(
  <>
      <path d="M6.3 6.5c3.8 3.6 7.5 7.3 11.2 11.1" />
      <path d="M17.6 6.4C13.9 10.1 10.2 13.8 6.6 17.6" />
  </>,
)

/** Chevron down — one bowed V. Replaces lucide ChevronDown. */
export const UiChevronDownIcon = icon(
  <>
      <path d="M5.9 9.3c2 2.1 4 4.1 6.1 6 2.1-1.9 4.1-3.9 6.1-6" />
  </>,
)

/** Share — arrow rising out of an open-topped tray.
 *  Replaces lucide Share. */
export const UiShareIcon = icon(
  <>
      <path d="M12 14.6c0-3.1 0-6.1 0-9.1" />
      <path d="M9.6 7.5C10.4 6.6 11.2 5.7 12.1 4.9C12.9 5.7 13.7 6.6 14.4 7.5" />
      <path d="M8.9 9.9C8.2 9.9 7.6 10 7.3 10.4C7 13.2 7 16 7.3 18.7C10.4 19 13.6 19 16.7 18.7C17 16 17 13.2 16.7 10.4C16.4 10 15.8 9.9 15.1 9.9" />
  </>,
)

/** Map pin — teardrop ending in a near-miss at its point, the centre a
 *  small loop. Replaces lucide MapPin. */
export const UiMapPinIcon = icon(
  <>
      <path d="M12 20C8.9 16.9 6.5 14 6.5 10.7C6.5 7.3 8.9 4.9 12 4.9C15.1 4.9 17.5 7.3 17.5 10.7C17.5 14 15.2 16.9 12.2 19.8" />
      <path d="M12 9.1C13 9.2 13.7 10 13.6 11C13.5 12 12.6 12.7 11.6 12.5C10.7 12.3 10.1 11.4 10.3 10.4C10.5 9.7 11.1 9.2 11.8 9.1" />
  </>,
)
