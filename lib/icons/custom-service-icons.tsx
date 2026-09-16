"use client"

import type { CSSProperties, ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

/**
 * Arco's hand-drawn service marks — one for every service on the
 * platform, drawn as a single family in the flowing one-pen hand:
 *
 *   - 2 to 6 strokes per mark; long lines run into each other without
 *     lifting (wall into roof into floor, cord into shade);
 *   - loops as accents (a curl on a crown, a rolled arm, a hook), and
 *     closures that end in a near-miss or dip through the line they
 *     meet — never a perfect Z-close;
 *   - "straight" lines are gentle curves; ellipses tilt; apexes stay
 *     sharp;
 *   - a scene over a symbol: objects sit on a ground line drawn only
 *     where it is needed.
 *
 * Every mark is normalized to the same optical size: its longest side
 * spans ~15.6 of the 24-unit canvas, centred on the disc. On the
 * discover service cards they render at 72px / stroke 0.45 (see
 * .service-quick-card in globals.css); elsewhere the shared 53px / 1
 * lockup applies.
 *
 * Each mimics the lucide prop surface (size / strokeWidth / style /
 * className) so resolveProfessionalServiceIcon can hand them out
 * interchangeably with lucide icons for services without a mark.
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

/** Architect — the one-pen house, faithful to the reference sketch:
 *  ONE stroke runs left wall → roof → right wall → floor, and the
 *  floor exists only from the right wall to the doorway (the left wall
 *  hangs free). The doorway is the second stroke: a tall arch whose
 *  left leg lands where the floor ends and whose right leg dips on
 *  below it. */
export const ArchitectIcon = mark(
  <>
      <path d="M4.9 19.1 C4.8 16.4 4.8 13.6 5.1 11 L12 4.4 L18.9 10.9 C19.2 13.6 19.2 16.2 19.1 18.6 C16.4 18.9 13.4 18.9 10.1 18.7" />
      <path d="M10 18.8 C9.8 16.6 9.9 14.7 10.5 13.7 C11.4 12.2 13.4 12.3 14.2 13.8 C14.7 15 14.7 17.1 14.5 20" />
  </>,
)

/** Art — a landscape painting on its hook: the big mountain rises
 *  from the frame's bottom edge (anchored low so it never reads as a
 *  chart), a second peak behind it, a sun loop above, and the cord
 *  running from both top corners to a hook curl on the wall. */
export const ArtIcon = mark(
  <>
      <path d="M4.6 8C4.3 11.8 4.3 15.8 4.7 19.5C9.6 19.9 14.6 19.9 19.4 19.3C19.8 15.5 19.8 11.7 19.4 8.1C14.5 7.6 9.5 7.6 4.2 8.1" />
      <path d="M5.2 19.2C7.1 16.3 9 13.5 11 10.9C12.6 12.9 14.1 14.9 15.5 17C16 17.7 16.5 18.5 16.9 19.2" />
      <path d="M15.4 16.9C16.3 15.4 17.3 14 18.4 12.7C18.8 13.4 19.1 14.2 19.4 15" />
      <path d="M14.7 10.1C15.5 9.5 16.6 9.7 17.1 10.5C17.6 11.3 17.3 12.4 16.4 12.8C15.6 13.1 14.6 12.7 14.3 11.8C14.1 11.2 14.3 10.6 14.6 10.2" />
      <path d="M6.6 8.2C8.3 6.9 10.1 5.7 12 4.8C13.9 5.7 15.6 6.9 17.2 8.1" />
      <path d="M12 4.6C11.8 3.9 12.4 3.4 12.9 3.8C13.3 4.1 13.2 4.7 12.7 4.8" />
  </>,
)

/** Bathrooms — the one-pen roll-top tub: rim and bowl are a single
 *  stroke that ends in a near-miss with its own start, two splayed
 *  feet, and the tap a J-hook curling over the rim. */
export const BathroomIcon = mark(
  <>
      <path d="M19.8 11.5 C14.6 12 9.4 12 4.2 11.6 C4.3 14.5 6.2 16.7 9.1 16.8 C11.1 16.9 13 16.9 14.9 16.8 C17.8 16.6 19.5 14.4 19.6 11.8" />
      <path d="M8.1 17 C7.9 17.5 7.7 18 7.4 18.5" />
      <path d="M15.9 16.9 C16.1 17.4 16.3 17.9 16.6 18.4" />
      <path d="M6.6 11.3 C6.5 9.8 6.5 8.3 6.9 7.1 C7.3 6 8.9 5.9 9.4 7 C9.7 7.6 9.7 8.3 9.6 8.9" />
  </>,
)

/** Builder — the hard hat face on, per the reference: dome over a
 *  double brim band, the centre panel two short seams with the little
 *  vent loop between them. */
export const BuilderIcon = mark(
  <>
      <path d="M5 15.6C5 10.7 8 7.4 12 7.4C16 7.4 19 10.8 19 15.7" />
      <path d="M3.9 15.9C9.3 16.5 14.7 16.5 20.1 15.7" />
      <path d="M4.5 17.5C9.5 18.2 14.5 18.2 19.5 17.4" />
      <path d="M10.6 7.7c-.2 1.4-.3 2.8-.2 4.2" />
      <path d="M13.4 7.7c.2 1.4.3 2.8.2 4.2" />
      <path d="M12 9.3c.3.4.3 1.1 0 1.5-.3-.4-.3-1.1 0-1.5" />
  </>,
)

/** Cabinet maker — the one-pen chest of drawers: body as a near-closed
 *  loop, two bowed drawer lines, three handle dashes, stubby feet. */
export const CabinetMakerIcon = mark(
  <>
      <path d="M4.7 5.4 C4.3 9.5 4.3 13.6 4.8 17.3 C9.8 17.8 14.8 17.8 19.3 17.3 C19.8 13.5 19.8 9.4 19.5 5.6 C14.4 5.1 9.4 5.1 4.2 5.6" />
      <path d="M4.8 9.5 c4.9 0.3 9.9 0.3 14.7 0" />
      <path d="M4.8 13.5 c4.9 0.3 9.9 0.3 14.7 0" />
      <path d="M10.9 7.4 c0.8 0.1 1.5 0.1 2.3 0" />
      <path d="M10.9 11.4 c0.8 0.1 1.5 0.1 2.3 0" />
      <path d="M10.9 15.4 c0.8 0.1 1.5 0.1 2.3 0" />
      <path d="M6.4 17.7 c0 0.6 0 1 0.1 1.6" />
      <path d="M17.6 17.6 c0 0.6 0 1 0.1 1.6" />
  </>,
)

/** Fireplaces — the one-pen mantel: posts and top drawn as one stroke
 *  (feet hanging free), the hearth an arch like the house doorway, a
 *  teardrop flame curling inside. */
export const FireplaceIcon = mark(
  <>
      <path d="M4.4 18.3 C4.2 14.1 4.2 9.8 4.4 6.1 C9.4 5.6 14.6 5.6 19.6 6.1 C19.8 9.9 19.8 14.2 19.6 18.4" />
      <path d="M8.2 18.5 C8 15.9 8 13.7 8.6 12.4 C9.7 9.9 14.3 10.1 15.4 12.5 C16 13.9 16 16.2 15.8 18.8" />
      <path d="M13 17.4 C11.8 17.1 11.2 15.8 11.9 14.7 C12.3 13.9 12.5 13.1 12.2 12.3 C13.7 13 14.5 14.3 14.1 15.8 C13.9 16.7 13.6 17.2 13 17.4" />
  </>,
)

/** Flooring — a simplified herringbone: six planks at 45°, two
 *  interlocking courses, each plank a near-closed loop. */
export const FlooringIcon = mark(
  <>
      <path d="M4.2 11.6 L8.6 7.2 L10.6 9.2 L6.2 13.6 L4.4 11.8" />
      <path d="M8.8 7 L13.2 11.4 L15.2 9.4 L10.8 5 L9 6.8" />
      <path d="M13.4 11.8 L17.8 7.4 L19.8 9.4 L15.4 13.8 L13.6 12" />
      <path d="M4.2 17.2 L8.6 12.8 L10.6 14.8 L6.2 19.2 L4.4 17.4" />
      <path d="M8.8 12.6 L13.2 17 L15.2 15 L10.8 10.6 L9 12.4" />
      <path d="M13.4 17.4 L17.8 13 L19.8 15 L15.4 19.4 L13.6 17.6" />
  </>,
)

/** Furniture — the sofa face on: one stroke over both rolled arms and
 *  around the base, the backrest an arc between them, a seat line and
 *  a cushion split making the front reading unmistakable, two feet. */
/** Upholstery — the curtain: a rail with one finial curl, and two
 *  panels each drawn in a single pen stroke that gathers across the
 *  top, falls, waves along the hem and climbs back to a near-miss
 *  closure. A curtain rather than a chair — the trade is the fabric,
 *  and a chair would only read as Furniture again. */
export const UpholsteryIcon = mark(
  <>
    <path d="M4.3 5.7C9 5.3 15 5.3 19.7 5.7c.4.1.5.5.3.8" />
    <path d="M5.5 6.6c.9-.5 1.7.4 2.6-.1.8-.5 1.6.4 2.5-.1C10.4 10 10.3 14.6 10 18.6c-1 .6-1.7-.5-2.5-.1-.8.4-1.4.8-2.3.1C5 14.6 5.1 10 5.5 6.8" />
    <path d="M18.6 6.6c-.9-.5-1.7.4-2.6-.1-.8-.5-1.6.4-2.5-.1C13.7 10 13.8 14.6 14.1 18.6c1 .6 1.7-.5 2.5-.1.8.4 1.4.8 2.3.1C19.1 14.6 19 10 18.6 6.8" />
  </>,
)

export const FurnitureIcon = mark(
  <>
      <path d="M6.6 11.8C6.6 10.9 6.6 9.9 6.4 9.2C6.1 8.1 4.5 8.3 4.4 9.5C4.2 11.7 4.2 14.2 4.4 16.5C9.4 16.9 14.6 16.9 19.6 16.5C19.8 14.2 19.8 11.7 19.6 9.4C19.5 8.2 17.9 8.1 17.6 9.2C17.4 9.9 17.4 10.9 17.4 11.8" />
      <path d="M7.1 11.5C7 9.7 7.1 8 7.4 6.5C10.5 6.2 13.6 6.2 16.7 6.5C17 8 17.1 9.8 17 11.6" />
      <path d="M7.1 12.5c3.3.3 6.5.3 9.8 0" />
      <path d="M12 6.6c0 1.9 0 3.9.1 5.8" />
      <path d="M6.1 16.8c0 .4 0 1 .1 1.4" />
      <path d="M17.9 16.7c0 .4 0 1 .1 1.4" />
  </>,
)

/** Garden designer — the flowing one-pen tree and sprout: trunk runs
 *  into the crown, which loops around past its own entry; the ground
 *  line flows into the sprout's stem in one stroke, its two leaves
 *  open curves that never quite close. */
export const GardenDesignIcon = mark(
  <>
      <path d="M8.9 19 C8.8 16.9 8.8 14.8 8.9 12.6 C6.7 12.3 5.2 10.8 5.3 8.9 C5.4 6.8 6.9 5.3 9 5.2 C11.1 5.1 12.5 6.8 12.4 8.9 C12.3 11.1 10.8 12.7 8.4 12.4" />
      <path d="M4.2 19 C8.6 19.3 12.9 19.3 17.1 19 C17 17.7 17 16.5 17.2 15.2" />
      <path d="M17.1 15.8 c-1.5 0.2 -2.5 -0.5 -2.7 -2 1.5 -0.2 2.5 0.5 2.8 1.8" />
      <path d="M17.3 15 c0.1 -1.4 1 -2.2 2.5 -2.3 -0.1 1.5 -1 2.3 -2.4 2.4" />
  </>,
)

/** Gardener — the pruning shears from the reference: pivot circle
 *  with its bolt dot, the long blade rising to a point, the curved
 *  counter-blade arcing left, and two handles with rounded ends. */
export const GardenerIcon = mark(
  <>
      <path d="M11.1 10.6 C11.9 10.7 12.3 11.4 12.1 12.2 C12 12.9 11.2 13.3 10.4 13 C9.8 12.7 9.5 12 9.9 11.3 C10.1 10.9 10.4 10.7 10.8 10.6" />
      <path d="M10.9 11.4 c0.4 0 0.7 0.3 0.7 0.7 0 0.4 -0.3 0.7 -0.7 0.7 -0.4 0 -0.7 -0.3 -0.7 -0.7 0 -0.4 0.3 -0.7 0.7 -0.7" />
      <path d="M11.3 10.5 C10.8 8.6 10.6 6.5 10.8 4.4 C12.2 6 13.1 7.9 13.3 10.1 C13.4 10.4 13.3 10.6 13.2 10.9" />
      <path d="M9.8 11.5 C8.1 11 6.7 10 5.6 8.5 C7.5 8.4 9.2 9 10.5 10.3" />
      <path d="M12.2 12.2 C14.1 12.8 15.9 13.5 17.7 14.3 C18.4 14.6 18.3 15.5 17.6 15.7 C15.6 15.3 13.7 14.7 11.9 13.9" />
      <path d="M10.3 13.2 C10.8 15.2 11.5 17.1 12.3 18.9 C12.6 19.5 11.9 20 11.4 19.5 C10.2 17.8 9.4 15.9 8.9 13.9" />
  </>,
)

/** Interior Designer — an armchair beside a floor lamp: the chair's
 *  back post runs into the seat and the rolled-arm curl in one stroke,
 *  front and base a second, two feet; the lamp is a shade loop on a
 *  long stem with an arched foot; one ground line under both. */
export const InteriorDesignIcon = mark(
  <>
      <path d="M5.1 18.8C4.9 16.3 4.9 13.7 5.2 11.3C5.3 10.2 6.5 10.1 6.7 11.2C6.9 12.5 6.9 13.9 7 15.2C8.1 15.5 9.3 15.5 10.4 15.3C10.8 14.2 12.2 14.2 12.5 15.2C12.8 16 12 16.7 11.3 16.3C10.9 16.1 10.8 15.6 11.1 15.2" />
      <path d="M12.6 15.5C12.9 16.5 13 17.6 12.9 18.7C10.3 19 7.6 19 5.2 18.6" />
      <path d="M6.1 18.9c0 .4 0 .8.1 1.2" />
      <path d="M11.8 18.9c0 .4 0 .8.1 1.2" />
      <path d="M15.4 8.3C15.7 7.1 16.1 5.9 16.6 4.8C17.4 4.6 18.3 4.6 19.1 4.8C19.6 5.9 19.9 7.1 20.1 8.3C18.5 8.6 16.9 8.6 15.4 8.4" />
      <path d="M17.7 8.7c0 3.3 0 6.5.1 9.8" />
      <path d="M16.1 19C16.5 18.3 17.1 17.9 17.8 17.9C18.5 17.9 19.1 18.3 19.5 18.9" />
      <path d="M4.3 19.6c5.1.4 10.3.4 15.4 0" />
  </>,
)

/** Interior stylist — a calmer styled shelf: one large vase with a
 *  tall branch and open leaf loop, one bowl, on a bowed shelf line. */
export const InteriorStylingIcon = mark(
  <>
      <path d="M3.9 17.7c5.4.3 10.9.3 16.3 0" />
      <path d="M8.9 17.5C8.3 15.2 8.3 12.9 9.1 10.9C9.6 9.5 12.2 9.5 12.8 10.9C13.5 12.9 13.5 15.2 12.9 17.5" />
      <path d="M10.9 10.1C10.9 8.3 11.1 6.5 11.7 4.9" />
      <path d="M11.5 7.2c-1.4-.1-2.3-1-2.4-2.5 1.4.1 2.3 1 2.5 2.3" />
      <path d="M14.8 14.6C16.5 14.3 18.2 14.3 19.9 14.6C19.7 16.3 18.6 17.5 17.2 17.5C15.9 17.5 14.9 16.3 14.8 14.7" />
  </>,
)

/** Kitchens — the one-pen frying pan from the reference: a tilted rim
 *  loop, the inner opening as a second near-closed loop, the pan wall
 *  as a lower band, and the handle flowing out to a rounded tip. */
export const KitchenIcon = mark(
  <>
      <path d="M4.2 12.2 C4.7 10.3 7.6 9.2 10.8 9.5 C14 9.8 16.4 11.3 16 13.1 C15.6 14.9 12.6 15.9 9.5 15.7 C6.5 15.4 4.2 13.9 4.3 12.2" />
      <path d="M6.2 13.2 C6.6 11.9 8.5 11.1 10.7 11.3 C12.9 11.5 14.5 12.5 14.2 13.8 C13.9 14.9 11.9 15.6 9.8 15.4 C7.8 15.2 6.3 14.2 6.3 13.2" />
      <path d="M4.8 13.7 C6 15.7 8.7 16.7 11.8 16.4 C13.9 16.2 15.6 15.3 16.1 13.9" />
      <path d="M14.6 10.4 C15.7 9.3 17 8.4 18.2 8 C19.2 7.7 19.8 8.7 19.1 9.3 C18.1 10.3 17 11.3 15.9 12.3" />
  </>,
)

/** Lighting — the classic table lamp from the reference: a wide
 *  trapezoid shade as one near-closed loop, a long thin stem, a dome
 *  base closed along its own bottom. */
export const LightingIcon = mark(
  <>
      <path d="M7.6 11.3 C8.1 8.8 8.8 6.6 9.5 4.6 C11.1 4.4 12.9 4.4 14.5 4.6 C15.2 6.6 15.9 8.8 16.4 11.3 C13.5 11.6 10.5 11.6 7.6 11.4" />
      <path d="M12 11.7 c0 2.5 0 4.8 0.1 7.2" />
      <path d="M8.8 19.8 C8.9 18.8 9.6 18.2 10.6 18.2 C11.6 18.1 12.6 18.1 13.6 18.2 C14.6 18.2 15.3 18.8 15.4 19.7 C13.2 20 10.9 20 8.8 19.8" />
  </>,
)

/** Lighting Designer — three pendants at three drops in the one-pen
 *  hand, drawn large: each pendant is ONE stroke, the cord running
 *  into its shade, around the mouth and back up to a near-miss. */
export const LightingDesignIcon = mark(
  <>
      <path d="M4.2 4.9c5.2.4 10.4.4 15.6 0" />
      <path d="M7.2 5.1C7.2 6.9 7.2 8.7 7.2 10.4C6.3 11.2 5.8 12.2 5.7 13.4C6.7 13.7 7.7 13.7 8.7 13.4C8.6 12.2 8.1 11.2 7.4 10.4" />
      <path d="M12 5.1C12 8.5 12 11.9 12 15.3C11.1 16.1 10.6 17.1 10.5 18.3C11.5 18.6 12.6 18.6 13.6 18.3C13.5 17.1 13 16.1 12.2 15.3" />
      <path d="M16.8 5.1C16.8 6.3 16.8 7.4 16.8 8.6C16 9.4 15.5 10.4 15.4 11.6C16.4 11.9 17.4 11.9 18.3 11.6C18.2 10.4 17.7 9.4 17 8.6" />
  </>,
)

/** Outdoor furniture — a sun lounger under a parasol, drawn clearly:
 *  the raised back flows into the bed's top edge in one stroke, a
 *  second edge gives the cushion its thickness, two splayed legs; the
 *  parasol is a wide fan with a wavy mouth, one rib and a slanted
 *  pole down to the ground line. */
export const OutdoorFurnitureIcon = mark(
  <>
      <path d="M4.5 9.9C6.1 11.2 7.7 12.4 9.4 13.5C12.4 13.4 15.4 13.2 18.4 12.9" />
      <path d="M9.2 14.6C12.3 14.5 15.4 14.3 18.5 14" />
      <path d="M10.4 14.7c-.6 1.3-1.2 2.6-1.9 3.9" />
      <path d="M16.8 14.3c.5 1.4 1.1 2.7 1.7 4.1" />
      <path d="M10.3 8.6C10.7 5.4 13.2 3.5 16.1 4C18.4 4.4 20 6 20.3 8.2C18.6 7.7 16.9 7.8 15.2 8.2C13.6 8.5 11.9 8.7 10.3 8.7" />
      <path d="M15.6 4.1C14.4 5.5 13.5 7 12.9 8.6" />
      <path d="M15.4 4.3C15.9 9 16.4 13.7 16.9 18.5" />
      <path d="M4.2 18.8c5.2.4 10.4.4 15.6 0" />
  </>,
)

/** Outdoor lighting — the tilted spotlight from the reference: a can
 *  aimed up-right (body with a rounded tail, rim as its own tilted
 *  loop), on a short post with splayed feet, two light-ray dashes. */
export const OutdoorLightingIcon = mark(
  <>
      <path d="M10.5 8 C9.1 9.3 7.5 10.8 6.2 12.3 C5.5 13 5.6 13.8 6.3 14.5 C6.9 15.1 7.5 15.6 8.2 16.1 C8.9 16.6 9.7 16.5 10.3 15.8 C11.6 14.4 13 12.9 14.3 11.4" />
      <path d="M10.4 7.8 C11.4 6.6 13.2 6.8 14 8.1 C14.7 9.1 14.9 10.6 14.3 11.6 C13.4 12.7 11.6 12.5 10.7 11.3 C10.1 10.2 9.9 8.8 10.4 7.9" />
      <path d="M10.3 18.3 c-0.1 -0.8 -0.1 -1.6 -0.2 -2.2" />
      <path d="M7.6 20 C8.4 19.2 9.3 18.6 10.3 18.4 C11.2 18.6 12.1 19.2 12.9 19.9" />
      <path d="M15.1 6 c0.2 -0.6 0.5 -1.2 0.8 -1.6" />
      <path d="M16.7 8.4 c0.6 -0.3 1.2 -0.5 1.8 -0.8" />
  </>,
)

/** Photographer — the simple one-pen camera from the reference sketch:
 *  a gently tilted body whose outline crosses past its own start, the
 *  viewfinder a small open-bottomed box on the top-left, a double lens
 *  (two near-closed loops) and a tiny dot top-right. */
export const PhotographerIcon = mark(
  <>
      <path d="M4.7 9.3 C4.2 12 4.5 15.2 5.4 17.8 C10.1 18.2 14.8 18 19.1 17.3 C19.8 14.6 19.7 11.6 18.9 8.9 C14.1 8.3 9.4 8.4 4.3 9.4" />
      <path d="M6.7 9.1 C6.6 8 6.7 7.2 6.9 6.5 C8.6 6.3 10.2 6.2 11.7 6.3 C11.9 7.1 11.9 7.8 11.8 8.6" />
      <path d="M12 9.7 C14.3 9.8 15.7 11.4 15.6 13.4 C15.5 15.5 13.8 17 11.8 16.9 C9.7 16.8 8.3 15.1 8.4 13 C8.5 11.1 10.1 9.7 12.3 9.8" />
      <path d="M12 11.8 C13 11.9 13.7 12.7 13.6 13.6 C13.5 14.5 12.6 15.1 11.7 15 C10.8 14.9 10.2 14 10.3 13 C10.4 12.3 11.1 11.7 11.9 11.8" />
      <path d="M17.2 10.1 c0.7 0.1 1 0.8 0.7 1.2 -0.3 0.5 -1.1 0.3 -1.2 -0.2 -0.1 -0.5 0.2 -0.9 0.6 -1" />
  </>,
)

/** Stairs & Elevators — the arched stairwell from the reference,
 *  simplified to two strokes: a tall arch (legs hanging free) and one
 *  zigzag of three steps climbing until it meets the right leg. */
export const StairsIcon = mark(
  <>
      <path d="M5.4 19.9 C5.2 16.4 5.2 12.9 5.6 10 C5.9 6.6 8.6 4.4 12 4.4 C15.4 4.4 18.1 6.7 18.4 10.1 C18.8 13 18.8 16.5 18.6 20" />
      <path d="M7.9 19.9 C7.9 18.8 7.9 17.8 8 16.9 C9.2 17 10.4 17 11.4 16.9 C11.3 15.8 11.3 14.8 11.4 13.8 C12.6 13.9 13.7 13.9 14.8 13.8 C14.7 12.8 14.7 11.7 14.8 10.8 C16.1 10.9 17.2 10.9 18.4 10.8" />
  </>,
)

/** Swimming pools — the one-pen pool ladder from the reference: two
 *  rails that each curl over at the top, three rungs drawn straight
 *  through them, feet hanging free. */
export const SwimmingPoolIcon = mark(
  <>
      <path d="M6.7 20 C6.4 15.5 6.4 10.8 6.7 6.7 C6.8 4.9 9 4.4 9.8 5.9 C10.2 6.7 10.2 7.5 10.1 8.3" />
      <path d="M14.7 19.1 C14.5 15.1 14.5 10.9 14.7 7.2 C14.8 5.4 17.1 4.9 17.9 6.4 C18.2 7.2 18.2 8 18.1 8.8" />
      <path d="M5.8 10.4 c3.3 0.4 6.5 0.4 9.8 0" />
      <path d="M5.9 14 c3.3 0.4 6.5 0.4 9.7 0" />
      <path d="M6 17.5 c3.1 0.3 6.3 0.3 9.4 0" />
  </>,
)

/** Tiles & Stones — brickwork in the one-pen hand, drawn tall: three
 *  bowed course lines with staggered joints between them. */
export const TilesStonesIcon = mark(
  <>
      <path d="M4.3 7.9c5.1.3 10.3.3 15.4 0" />
      <path d="M4.2 12.2c5.2.3 10.4.3 15.6 0" />
      <path d="M4.1 16.5c5.3.3 10.6.3 15.9-.1" />
      <path d="M9.4 8.1c0 1.3.1 2.6.1 3.9" />
      <path d="M14.9 8c0 1.4.1 2.7.1 4" />
      <path d="M6.7 12.4c0 1.3 0 2.6.1 3.9" />
      <path d="M12 12.3c0 1.4 0 2.7.1 4" />
      <path d="M17.3 12.3c0 1.3 0 2.6 0 3.9" />
  </>,
)

/** Windows & doors — a straighter door: vertical stiles with only the
 *  top corners rounded, legs dipping through the floor line, a knob
 *  loop on the right stile. */
export const WindowsDoorsIcon = mark(
  <>
      <path d="M7.7 19.5C7.6 16 7.6 12.3 7.8 8.9C7.8 7.5 8.6 6.7 10 6.6C11.3 6.5 12.7 6.5 14 6.6C15.4 6.7 16.2 7.5 16.2 8.9C16.4 12.4 16.4 16.1 16.3 19.9" />
      <path d="M4.4 19.2c5.1.5 10.2.5 15.3.1" />
      <path d="M14.4 13.9c.5.1.7.6.5 1-.3.4-.9.3-1-.2-.1-.4.2-.7.5-.8" />
  </>,
)

/** Structural engineer — ruler and pencil, per the reference: a tall
 *  ruler loop with four tick dashes, a pencil crossing diagonally
 *  (outline closing into its own tip) with a ridge line. */
export const StructuralEngineerIcon = mark(
  <>
      <path d="M5.4 4.9C5.2 9.7 5.2 14.5 5.5 19.1C6.5 19.4 7.6 19.4 8.6 19.1C8.9 14.5 8.9 9.7 8.7 5C7.6 4.7 6.4 4.7 5.3 5" />
      <path d="M5.7 7.4c.4 0 .8 0 1.2.1" />
      <path d="M5.7 10.3c.4 0 .8 0 1.2.1" />
      <path d="M5.7 13.2c.4 0 .8 0 1.2.1" />
      <path d="M5.7 16.1c.4 0 .8 0 1.2.1" />
      <path d="M11 14.9C13.3 12.5 15.6 10.1 17.9 7.8C18.6 7.1 19.7 8 19.1 8.8C16.9 11.3 14.6 13.7 12.3 16C11.7 16.3 11.1 16.4 10.5 16.4C10.6 15.9 10.8 15.3 11 14.9" />
      <path d="M11.9 15C14.2 12.7 16.4 10.3 18.6 8" />
  </>,
)

/** Roofing — a double-drawn gable (the second line gives the roof its
 *  thickness) with a small open-bottomed chimney on the left slope. */
export const RoofingIcon = mark(
  <>
      <path d="M4.2 16.1C6.8 13.5 9.4 10.9 12 8.4C14.6 10.9 17.2 13.5 19.8 16" />
      <path d="M5.1 16.8C7.4 14.5 9.7 12.2 12 10C14.3 12.2 16.6 14.5 18.9 16.7" />
      <path d="M6.9 13.2C6.9 12.2 6.9 11.2 7 10.3C7.7 10.2 8.4 10.2 9.1 10.3C9.2 11 9.2 11.6 9.2 12.3" />
  </>,
)

/** Wellness — the sauna bucket per the reference: a wide low tub
 *  (open rim ellipse, tapered body), and the ladle beside it — a big
 *  tilted oval bowl at the left whose handle rises and kinks over the
 *  tub's rim. */
export const WellnessIcon = mark(
  <>
      <path d="M8.7 11.9C8.6 10.8 10.7 10 13.3 10C15.9 10 17.9 10.8 18 11.9C18 13 16 13.8 13.4 13.8C10.9 13.8 8.9 13.1 8.8 12" />
      <path d="M9 12.6C9.1 14.4 9.5 16.2 10.3 17.9C12.5 18.2 14.7 18.2 16.8 17.9C17.5 16.2 17.9 14.4 18 12.6" />
      <path d="M7.7 11.7C8.3 12.6 7.8 13.9 6.6 14.4C5.5 14.9 4.2 14.6 3.9 13.6C3.6 12.6 4.4 11.5 5.5 11.3C6.4 11.1 7.2 11.3 7.6 11.8" />
      <path d="M7.5 11.4C8.6 10.3 9.8 9.3 11.1 8.4C11.7 8 12.3 8.5 12.2 9.2C12.1 9.8 12 10.4 11.9 11" />
  </>,
)

/** Electrical systems — a lightning bolt outlined in one stroke,
 *  ending in a near-miss with its start. */
export const ElectricalIcon = mark(
  <>
      <path d="M13.6 4.5C11.7 7.3 9.9 10.2 8.2 13.2C9.7 13.3 11.2 13.3 12.7 13.2C11.4 15.4 10.2 17.6 9.1 19.9C11.5 17.2 13.9 14.4 16.2 11.5C14.7 11.4 13.3 11.4 11.8 11.5C12.4 9.2 13 6.8 13.6 4.6" />
  </>,
)

/** Heating & Ventilation — three rising heat waves over a floor line. */
export const HeatingVentilationIcon = mark(
  <>
      <path d="M8.2 17.1C7.4 15.4 7.5 13.8 8.5 12.4C9.4 11.1 9.5 9.6 8.7 8.2" />
      <path d="M12.1 17.2C11.3 15.5 11.4 13.9 12.4 12.5C13.3 11.2 13.4 9.7 12.6 8.3" />
      <path d="M16 17.1C15.2 15.4 15.3 13.8 16.3 12.4C17.2 11.1 17.3 9.6 16.5 8.2" />
      <path d="M6.4 19.6c3.8.3 7.6.3 11.4 0" />
  </>,
)

/** Security systems — the CCTV camera per the reference: an angular
 *  boxy body tilting down toward the lens end, a top-plane edge for
 *  the 3/4 view, the lens loop on the front face, a vent dash, and
 *  the mount arm dipping from the underside to its foot line. */
export const SecurityIcon = mark(
  <>
      <path d="M18.5 5.2C14.3 6.1 10.1 7 5.9 8.1C6.1 9.3 6.3 10.5 6.6 11.6C10.8 10.7 15 9.7 19.1 8.6C18.9 7.5 18.7 6.3 18.5 5.3" />
      <path d="M6.3 7.2C10.4 6.1 14.5 5.2 18.7 4.4C18.7 4.7 18.6 5 18.5 5.2" />
      <path d="M7.4 8.6C8.1 8.8 8.6 9.5 8.4 10.2C8.2 10.9 7.5 11.3 6.8 11.1C6.1 10.9 5.7 10.2 5.9 9.5C6 9 6.5 8.6 7 8.6" />
      <path d="M15.2 6.3c.9-.2 1.7-.4 2.6-.6" />
      <path d="M14.5 9.8C15 11.2 15.7 12.4 16.7 13.3C16.6 14.1 16.1 14.7 15.5 15.1" />
      <path d="M13.5 16.5c1.7.2 3.4.2 5.1 0" />
  </>,
)

/** Smart homes — a toggle flipped ON, per the reference: pill track
 *  as a near-closed loop, the knob on the RIGHT with a flowing
 *  checkmark inside. */
export const SmartHomeIcon = mark(
  <>
      <path d="M8.2 8.1C10.7 7.9 13.3 7.9 15.8 8.1C17.9 8.3 19.5 9.9 19.6 12C19.7 14.2 18 15.8 15.9 16C13.4 16.2 10.8 16.2 8.3 16C6.2 15.8 4.6 14.2 4.5 12.1C4.4 9.9 6.1 8.2 8.1 8.2" />
      <path d="M15.9 9.2C17.6 9.3 18.8 10.6 18.7 12.2C18.6 13.8 17.2 15 15.6 14.8C14.1 14.6 13 13.3 13.2 11.8C13.3 10.4 14.4 9.3 15.8 9.2" />
      <path d="M14.6 12.1C15 12.6 15.4 13 15.8 13.4C16.5 12.3 17.2 11.3 17.9 10.4" />
  </>,
)

/** Solar panels — the sun as a loop with ray flicks all the way
 *  around, over the tilted panel with its two-by-two cell grid. */
export const SolarIcon = mark(
  <>
      <path d="M4.6 18.3L9.6 11.6L18.9 13.5L14.3 20.1L4.9 18.5" />
      <path d="M7.1 15C10.2 15.6 13.3 16.3 16.4 16.9" />
      <path d="M14.2 12.5C12.7 14.7 11.2 16.9 9.8 19.2" />
      <path d="M7.3 3.5C8.7 3.6 9.7 4.7 9.6 6C9.5 7.3 8.3 8.2 7 8C5.8 7.8 5 6.7 5.2 5.5C5.4 4.4 6.2 3.6 7.2 3.5" />
      <path d="M7.2 1.5c0 .4 0 .9 0 1.3" />
      <path d="M7.2 8.8c0 .4 0 .9 0 1.3" />
      <path d="M10.6 5.7c.4 0 .9 0 1.3 0" />
      <path d="M2.5 5.7c.4 0 .9 0 1.3 0" />
      <path d="M9.4 3.4c.3-.3.6-.6.9-.9" />
      <path d="M5 3.4c-.3-.3-.6-.6-.9-.9" />
      <path d="M9.4 7.8c.3.3.6.6.9.9" />
      <path d="M5 7.8c-.3.3-.6.6-.9.9" />
  </>,
)

/** Painter — the roller face on, per the reference: wide sleeve as a
 *  near-closed loop, the frame hooking out left and down to centre,
 *  the grip its own rounded loop. */
export const PainterIcon = mark(
  <>
      <path d="M6.9 5.2C10.3 4.9 13.7 4.9 17.1 5.2C17.3 6.2 17.3 7.2 17.1 8.1C13.7 8.4 10.3 8.4 6.9 8.1C6.7 7.2 6.7 6.2 6.9 5.3" />
      <path d="M6.6 6.7C5.5 6.7 4.9 7.3 4.9 8.4C4.9 9.5 5.6 10.1 6.7 10.2C8.5 10.3 10.3 10.3 12 10.3C12 11.2 12 12 12 12.9" />
      <path d="M10.9 13.2C10.8 15.1 10.8 17 11 18.8C11.7 19.1 12.5 19.1 13.2 18.8C13.4 17 13.4 15.1 13.3 13.2C12.5 12.9 11.7 12.9 11 13.2" />
  </>,
)

/** Fencing & Gates — a modern low, wide gate per the reference: two
 *  posts with flat caps, a top and bottom rail spanning between them
 *  (the bottom rail on the ground, level with the post feet), and
 *  five vertical bars. */
export const FencingIcon = mark(
  <>
      <path d="M4.7 18.7C4.6 15.7 4.6 12.6 4.8 9.8" />
      <path d="M3.7 9.6c.9-.1 1.9-.1 2.8 0" />
      <path d="M19.3 18.7C19.4 15.7 19.4 12.6 19.2 9.8" />
      <path d="M17.8 9.6c.9-.1 1.9-.1 2.8 0" />
      <path d="M5.6 12.4C9.9 12.1 14.2 12.1 18.5 12.4" />
      <path d="M5.6 18.1C9.9 18.4 14.2 18.4 18.5 18.1" />
      <path d="M7.9 12.4C7.8 14.3 7.8 16.2 7.9 18.1" />
      <path d="M9.9 12.4C9.8 14.3 9.8 16.2 9.9 18.1" />
      <path d="M12 12.3C11.9 14.2 11.9 16.2 12 18.2" />
      <path d="M14.1 12.4C14 14.3 14 16.2 14.1 18.1" />
      <path d="M16.1 12.4C16 14.3 16 16.2 16.1 18.1" />
  </>,
)

/** Shed builder — an open timber canopy per the reference: gable
 *  roof with overhang, tie beam and king post (the truss), two open
 *  posts down to the ground line — no walls, no door. */
export const ShedBuilderIcon = mark(
  <>
      <path d="M4.4 11.9C7 10 9.5 8.1 12 6.3C14.5 8.1 17 10 19.6 11.8" />
      <path d="M6.6 10.3C10.2 9.9 13.8 9.9 17.4 10.2" />
      <path d="M12 6.9C12 8 12 9.1 12 10.1" />
      <path d="M6.9 10.5C6.8 13.4 6.8 16.3 7 19.1" />
      <path d="M17.1 10.5C17.2 13.4 17.2 16.3 17 19.1" />
      <path d="M4.2 19.3c5.2.4 10.4.4 15.6 0" />
  </>,
)

/** Person — the family's avatar fallback (team page, account,
 *  header pill): a tilted head loop that closes in a near-miss, and
 *  ONE stroke for the bust — up over the left shoulder, down the
 *  right, base line drawn only on the way back and stopping shy of
 *  where it started. */
export const PersonIcon = mark(
  <>
      <path d="M11.4 4.3 C9.8 4.6 9.1 6.6 10 7.9 C10.9 9.2 13.3 9.2 14.1 7.9 C14.9 6.5 14 4.5 12.5 4.4" />
      <path d="M6.2 19.6 C6.5 15.1 9 12.5 12 12.5 C15 12.5 17.5 15.2 17.8 19.2 C13.9 19.6 10.3 19.6 7 19.4" />
  </>,
)
