/**
 * Segmented progress bar for new project flow
 * Shows 3 sections: Details (4 steps), Photos (4 steps), Professionals (4 steps)
 * Total: 12 steps
 */

const DETAILS_STEPS = 4
const PHOTOS_STEPS = 4
const PROFESSIONALS_STEPS = 4
const TOTAL_STEPS = DETAILS_STEPS + PHOTOS_STEPS + PROFESSIONALS_STEPS // 13

type SegmentedProgressBarProps = {
  currentGlobalStep: number // 1-13
}

export function SegmentedProgressBar({ currentGlobalStep }: SegmentedProgressBarProps) {
  // Calculate percentage for each section
  const detailsWidth = (DETAILS_STEPS / TOTAL_STEPS) * 100 // ~38.5%
  const photosWidth = (PHOTOS_STEPS / TOTAL_STEPS) * 100 // ~30.8%
  const professionalsWidth = (PROFESSIONALS_STEPS / TOTAL_STEPS) * 100 // ~30.8%

  // Determine which section is active and how much progress within that section
  const getSegmentProgress = (segmentStart: number, segmentSteps: number) => {
    if (currentGlobalStep < segmentStart) return 0
    if (currentGlobalStep >= segmentStart + segmentSteps) return 100
    return ((currentGlobalStep - segmentStart + 1) / segmentSteps) * 100
  }

  const detailsProgress = getSegmentProgress(1, DETAILS_STEPS)
  const photosProgress = getSegmentProgress(DETAILS_STEPS + 1, PHOTOS_STEPS)
  const professionalsProgress = getSegmentProgress(DETAILS_STEPS + PHOTOS_STEPS + 1, PROFESSIONALS_STEPS)

  return (
    <div className="w-full">
      <div className="flex h-2 w-full gap-1">
        {/* Details section */}
        <div
          className="relative h-2 rounded-full bg-surface overflow-hidden"
          style={{ width: `${detailsWidth}%` }}
        >
          <div
            className="h-full rounded-full bg-secondary transition-all duration-300 ease-out"
            style={{ width: `${detailsProgress}%` }}
          />
        </div>

        {/* Photos section */}
        <div
          className="relative h-2 rounded-full bg-surface overflow-hidden"
          style={{ width: `${photosWidth}%` }}
        >
          <div
            className="h-full rounded-full bg-secondary transition-all duration-300 ease-out"
            style={{ width: `${photosProgress}%` }}
          />
        </div>

        {/* Professionals section */}
        <div
          className="relative h-2 rounded-full bg-surface overflow-hidden"
          style={{ width: `${professionalsWidth}%` }}
        >
          <div
            className="h-full rounded-full bg-secondary transition-all duration-300 ease-out"
            style={{ width: `${professionalsProgress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
