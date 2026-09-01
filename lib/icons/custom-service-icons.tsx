"use client"

import type { CSSProperties, ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

/**
 * Arco's hand-drawn service marks — one for every service on the
 * platform, drawn as a single family rather than picked from a stock
 * icon set. The house style: 24x24, stroke only, four to eight strokes,
 * curves over boxes, nothing mirrored, and a scene rather than a symbol
 * (the object sits on a floor line, a shelf, a ceiling).
 *
 * They render at stroke weight 1 by default, which is lighter than
 * lucide's 1.5 — at that weight a mark has to earn its reading from
 * shape alone, so none of them lean on fine detail.
 *
 * Each mimics the lucide prop surface (size / strokeWidth / style /
 * className) so resolveProfessionalServiceIcon can hand them out
 * interchangeably with the lucide icons still used for the services
 * that have no mark of their own yet.
 */

type IconProps = {
  size?: number | string
  strokeWidth?: number | string
  style?: CSSProperties
  className?: string
}

/** Wraps a mark's path data in the shared canvas. */
const mark = (children: ReactNode) =>
  (({ size = 24, strokeWidth = 1, style, className }: IconProps) => (
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

/** Architect — a gable house with a doorway, a shrub at one corner. */
export const ArchitectIcon = mark(
  <>
      <path d="M3.6 11.4 12 4.9l8.4 6.5" />
      <path d="M6 11.9v6.7" />
      <path d="M18 11.9v6.7" />
      <path d="M10.3 18.6v-3.4a1.7 1.7 0 0 1 3.4 0v3.4" />
      <path d="M2.6 18.7h18.8" />
      <path d="M20.4 18.6v-2.3" />
      <path d="M20.4 16.4c-1 0-1.6-.6-1.6-1.7 1 0 1.6.6 1.6 1.7z" />
  </>,
)

/** Art — a framed picture on its hook. */
export const ArtIcon = mark(
  <>
      <path d="M6.2 8.5h11.6v9.1H6.2z" />
      <path d="m8.5 15.3 2.5-2.9 1.8 2 1.6-1.8 1.4 2.7z" />
      <path d="M12 8.5V6.4" />
      <circle cx="12" cy="5.6" r=".8" />
  </>,
)

/** Bathrooms — a roll-top tub on its feet, tap arcing over the rim. */
export const BathroomIcon = mark(
  <>
      <path d="M3.9 12.6h16.2v2.2a4 4 0 0 1-4 4H7.9a4 4 0 0 1-4-4z" />
      <path d="m7.6 18.8-.7 1.5" />
      <path d="m16.4 18.8.7 1.5" />
      <path d="M6.4 12.5V8.2a1.7 1.7 0 0 1 1.7-1.7h1.3" />
      <path d="M9.4 5.6v1.8" />
  </>,
)

/** Builder — a hard hat with a swept brim. */
export const BuilderIcon = mark(
  <>
      <path d="M6.4 16.5v-3.1a5.6 5.6 0 0 1 11.2 0v3.1" />
      <path d="M12 7.9v8.6" />
      <path d="M9.2 9.1c-.5 2.4-.7 4.9-.6 7.4" />
      <path d="M14.8 9.1c.5 2.4.7 4.9.6 7.4" />
      <path d="M4.2 16.5h15.6a1.1 1.1 0 0 1 0 2.2H4.2a1.1 1.1 0 0 1 0-2.2z" />
  </>,
)

/** Cabinet maker — a chest of drawers on its feet. */
export const CabinetMakerIcon = mark(
  <>
      <path d="M5.2 6.9h13.6v10.9H5.2z" />
      <path d="M5.2 10.5h13.6" />
      <path d="M5.2 14.1h13.6" />
      <path d="M10.8 8.7h2.4" />
      <path d="M10.8 12.3h2.4" />
      <path d="M10.8 15.9h2.4" />
      <path d="M6.6 17.8v1.3" />
      <path d="M17.4 17.8v1.3" />
  </>,
)

/** Fireplaces — a mantel over an open hearth. */
export const FireplaceIcon = mark(
  <>
      <path d="M3.4 7.6h17.2" />
      <path d="M5.4 7.6v11.1" />
      <path d="M18.6 7.6v11.1" />
      <path d="M3.4 18.7h17.2" />
      <path d="M8.3 18.7v-6.1h7.4v6.1" />
      <path d="M12 17c-1.2-.6-1.7-1.5-1.4-2.7.5.5.9.6 1.2.4-.3-1 .1-1.9.9-2.5 0 1.1.3 1.7 1 2.1.6.4.8 1 .6 1.7-.3.7-1 1-2.3 1z" />
  </>,
)

/** Flooring — boards laid, one more coming down at an angle. */
export const FlooringIcon = mark(
  <>
      <path d="M3.6 13.6h16.8v2.3H3.6z" />
      <path d="M3.6 16.4h16.8v2.3H3.6z" />
      <path d="m6.4 12.2 11.2-6.5 1.2 2-11.2 6.5z" />
  </>,
)

/** Furniture — a sofa in profile. */
export const FurnitureIcon = mark(
  <>
      <path d="M4.2 17.5v-4.1a1.5 1.5 0 0 1 3 0v1.3h9.6v-1.3a1.5 1.5 0 0 1 3 0v4.1z" />
      <path d="M7.2 14.7h9.6" />
      <path d="M6.4 17.5v1.5" />
      <path d="M17.6 17.5v1.5" />
      <path d="M7.2 12.9V9.8a1.4 1.4 0 0 1 1.4-1.4h6.8a1.4 1.4 0 0 1 1.4 1.4v3.1" />
  </>,
)

/** Garden designer — a tree and a low shrub on a ground line. */
export const GardenDesignIcon = mark(
  <>
      <path d="M2.8 19.1h18.4" />
      <path d="M9.1 19.1v-5" />
      <path d="M9.1 14.3a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
      <path d="M16.6 19.1v-3.4" />
      <path d="M16.6 16.4c-2 0-3.1-1.1-3.1-3.1 2 0 3.1 1.1 3.1 3.1z" />
      <path d="M16.6 15.6c1.7 0 2.7-1 2.7-2.7-1.7 0-2.7 1-2.7 2.7z" />
  </>,
)

/** Gardener — a watering can, hooped handle and long spout. */
export const GardenerIcon = mark(
  <>
      <path d="M9.6 11.2h8.4l-1.1 6.3a1.7 1.7 0 0 1-1.7 1.4h-2.8a1.7 1.7 0 0 1-1.7-1.4z" />
      <path d="M11.9 11.2a2.6 2.6 0 0 1 3.6 0" />
      <path d="M18.2 11.8a2.5 2.5 0 0 1 .4 3.7" />
      <path d="M9.9 15.9 4.4 9.6" />
      <path d="M11.3 14.7 5.8 8.4" />
      <path d="m4.4 9.6 1.4-1.2" />
  </>,
)

/** Interior Designer — a curved lounge chair in profile beneath a pendant light. */
export const InteriorDesignIcon = mark(
  <>
      <path d="M8.2 4.8c-1 3.4-1.1 6.4-.4 9" />
      <path d="M7.8 13.8c2.5 1.1 6.3 1.2 9.2.3" />
      <path d="M9.3 11.2c1.9.7 4.1.8 5.9.4" />
      <path d="M16.9 14.2l1.1 4.2" />
      <path d="M8 14l-1 4.4" />
      <path d="M17.4 3.2v2.5" />
      <circle cx="17.4" cy="7.2" r="1.4" />
  </>,
)

/** Interior stylist — a shelf styled with a vase and a bowl. */
export const InteriorStylingIcon = mark(
  <>
      <path d="M9.6 11.3h4.8l-.8 5a1.5 1.5 0 0 1-1.5 1.3 1.5 1.5 0 0 1-1.5-1.3z" />
      <path d="M12 11.3V6.5" />
      <path d="M12 9c-1.2-.5-1.7-1.5-1.5-2.8 1.2.2 1.7 1.2 1.5 2.8z" />
      <path d="M12.9 9.7c1.2-.6 1.7-1.7 1.5-3-1.2.3-1.7 1.4-1.5 3z" />
      <path d="M4.6 15.4h4.6a2.3 2.3 0 0 1-2.3 2.2 2.3 2.3 0 0 1-2.3-2.2z" />
      <path d="M4.2 17.7h15.6" />
  </>,
)

/** Kitchens — a counter with a tap arcing over it. */
export const KitchenIcon = mark(
  <>
      <path d="M3.2 10.7h17.6" />
      <path d="M5 10.7v8h14v-8" />
      <path d="M5 14.6h14" />
      <path d="M8.8 12.5h2.4" />
      <path d="M8.8 16.4h2.4" />
      <path d="M16.2 10.6V7.9a1.9 1.9 0 0 1 1.9-1.9h.7" />
  </>,
)

/** Lighting — a table lamp on a console. */
export const LightingIcon = mark(
  <>
      <path d="m8.9 11.2 1.6-4.8h3l1.6 4.8z" />
      <path d="M12 11.2v4.2" />
      <path d="M10.2 15.4h3.6" />
      <path d="M5.4 17.7h13.2" />
      <path d="M6.8 17.7v1.4" />
      <path d="M17.2 17.7v1.4" />
  </>,
)

/** Lighting Designer — three pendants hung from one ceiling at three drops. */
export const LightingDesignIcon = mark(
  <>
      <path d="M3.4 4.6h17.2" />
      <path d="M7.4 4.6v3.4" />
      <path d="M12 4.6v5.6" />
      <path d="M16.6 4.6v1.6" />
      <path d="m5.7 11.4 1-3.4h1.4l1 3.4z" />
      <path d="m9.9 14.2 1.1-4h2l1.1 4z" />
      <path d="m14.9 9.6 1-3.4h1.4l1 3.4z" />
  </>,
)

/** Outdoor furniture — a garden bench. */
export const OutdoorFurnitureIcon = mark(
  <>
      <path d="M4.4 14.3h15.2" />
      <path d="M5.7 14.3v4.5" />
      <path d="M18.3 14.3v4.5" />
      <path d="M6.4 14.3V8.7h11.2v5.6" />
      <path d="M6.4 11.5h11.2" />
  </>,
)

/** Outdoor lighting — a lamp post over its pool of light. */
export const OutdoorLightingIcon = mark(
  <>
      <path d="M12 17.7v-5.3" />
      <path d="M9.8 12.4h4.4l-1.1-3.7h-2.2z" />
      <path d="M10.3 8.7h3.4" />
      <path d="M12 8.7V7.3" />
      <path d="m8.5 10.9-1.3-.8" />
      <path d="m15.5 10.9 1.3-.8" />
      <ellipse cx="12" cy="18.1" rx="5.6" ry="1.5" />
  </>,
)

/** Photographer — a camera body on a splayed tripod. */
export const PhotographerIcon = mark(
  <>
      <path d="M7.7 7.1h2l.9-1.3h2.8l.9 1.3h2a1.4 1.4 0 0 1 1.4 1.4v3.4a1.4 1.4 0 0 1-1.4 1.4H7.7a1.4 1.4 0 0 1-1.4-1.4V8.5a1.4 1.4 0 0 1 1.4-1.4z" />
      <circle cx="12" cy="10.2" r="1.8" />
      <path d="M12 13.6v1.7" />
      <path d="m12 15.3-3.5 4" />
      <path d="m12 15.3 3.5 4" />
      <path d="M12 15.3v4" />
      <path d="M19.6 5.4v1.2" />
      <path d="M20.9 6.4h-1.2" />
  </>,
)

/** Stairs & Elevators — a flight of stairs under its handrail. */
export const StairsIcon = mark(
  <>
      <path d="M3.6 19.1h3.9v-3.3h3.9v-3.3h3.9V9.2h3.9" />
      <path d="M4.6 15.6 19.3 5.2" />
      <path d="M4.6 15.6v3.5" />
      <path d="M11.9 10.5v2" />
      <path d="M19.3 5.2v4" />
  </>,
)

/** Swimming pools — a pool in section, ripples and a handrail. */
export const SwimmingPoolIcon = mark(
  <>
      <path d="M3.3 11.4h17.4" />
      <path d="M4.9 11.4v7.7" />
      <path d="M19.1 11.4v7.7" />
      <path d="M4.9 19.1h14.2" />
      <path d="M6.5 14.6c.9-.8 1.9-.8 2.8 0s1.9.8 2.8 0 1.9-.8 2.8 0" />
      <path d="M7.4 17.1c.9-.8 1.9-.8 2.8 0s1.9.8 2.8 0" />
      <path d="M15.6 11.3V7.9a1.7 1.7 0 0 1 3.4 0v3.4" />
      <path d="M15.6 9.3h3.4" />
  </>,
)

/** Tiles & Stones — a run of brickwork. */
export const TilesStonesIcon = mark(
  <>
      <path d="M3.6 7.4h16.8v9.9H3.6z" />
      <path d="M3.6 10.7h16.8" />
      <path d="M3.6 14h16.8" />
      <path d="M9.2 7.4v3.3" />
      <path d="M14.8 7.4v3.3" />
      <path d="M6.4 10.7V14" />
      <path d="M12 10.7V14" />
      <path d="M17.6 10.7V14" />
      <path d="M9.2 14v3.3" />
      <path d="M14.8 14v3.3" />
  </>,
)

/** Windows & doors — a casement window, one light swung open. */
export const WindowsDoorsIcon = mark(
  <>
      <path d="M5.2 4.9h13.6v12.3H5.2z" />
      <path d="M12 4.9v12.3" />
      <path d="M5.2 11.1h13.6" />
      <path d="M3.9 17.2h16.2" />
      <path d="M10.6 9.6v-1" />
      <path d="M13.4 9.6v-1" />
  </>,
)
