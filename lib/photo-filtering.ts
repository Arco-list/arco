/**
 * Photo filtering utilities for project photo management.
 *
 * These utilities handle the complex business logic for determining which photos
 * should be selectable for different project features.
 */

import { ADDITIONAL_FEATURE_ID, BUILDING_FEATURE_ID } from "@/hooks/use-project-photo-tour"

/**
 * Determines if a photo should be selectable for a given feature.
 *
 * Business Rules:
 * - Each feature modal shows ONLY:
 *   1. Photos already assigned to that specific feature
 *   2. Photos in "Additional photos" (the unassigned pool)
 * - Photos assigned to other features (BUILDING or custom features) are NOT selectable
 * - When a photo is deselected from a feature, it goes back to "Additional photos"
 *
 * @param photoAssignment - The current feature assignment of the photo (undefined if unassigned)
 * @param targetFeature - The feature for which we're checking selectability
 * @returns true if the photo should be selectable for the target feature
 *
 * @example
 * // Photo in Additional photos is selectable for Kitchen
 * isPhotoSelectableForFeature(ADDITIONAL_FEATURE_ID, "kitchen-id") // true
 *
 * @example
 * // Photo already in Kitchen is selectable for Kitchen
 * isPhotoSelectableForFeature("kitchen-id", "kitchen-id") // true
 *
 * @example
 * // Photo in Building is NOT selectable for Kitchen
 * isPhotoSelectableForFeature(BUILDING_FEATURE_ID, "kitchen-id") // false
 *
 * @example
 * // Photo in Kitchen is NOT selectable for Bathroom
 * isPhotoSelectableForFeature("kitchen-id", "bathroom-id") // false
 */
export function isPhotoSelectableForFeature(
  photoAssignment: string | undefined,
  targetFeature: string,
): boolean {
  // Rule 1: Photos assigned to the current feature are always selectable
  if (photoAssignment === targetFeature) {
    return true
  }

  // Rule 2: Photos in "Additional photos" are selectable for any feature
  if (photoAssignment === ADDITIONAL_FEATURE_ID) {
    return true
  }

  // Rule 3: All other photos (assigned to different features) are NOT selectable
  return false
}
