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
 * - Unassigned photos are always selectable for any feature
 * - Photos assigned to the current feature are always selectable
 * - BUILDING and ADDITIONAL features share photos bidirectionally:
 *   - Photos assigned to BUILDING can be selected for ADDITIONAL and vice versa
 * - Other features can select from the BUILDING and ADDITIONAL photo pools
 *
 * @param photoAssignment - The current feature assignment of the photo (undefined if unassigned)
 * @param targetFeature - The feature for which we're checking selectability
 * @returns true if the photo should be selectable for the target feature
 *
 * @example
 * // Unassigned photo is selectable for any feature
 * isPhotoSelectableForFeature(undefined, "custom-feature") // true
 *
 * @example
 * // Photo assigned to current feature is selectable
 * isPhotoSelectableForFeature("custom-feature", "custom-feature") // true
 *
 * @example
 * // BUILDING and ADDITIONAL features share photos
 * isPhotoSelectableForFeature(BUILDING_FEATURE_ID, ADDITIONAL_FEATURE_ID) // true
 * isPhotoSelectableForFeature(ADDITIONAL_FEATURE_ID, BUILDING_FEATURE_ID) // true
 *
 * @example
 * // Other features can select from BUILDING/ADDITIONAL pools
 * isPhotoSelectableForFeature(BUILDING_FEATURE_ID, "custom-feature") // true
 * isPhotoSelectableForFeature(ADDITIONAL_FEATURE_ID, "custom-feature") // true
 */
export function isPhotoSelectableForFeature(
  photoAssignment: string | undefined,
  targetFeature: string,
): boolean {
  // Rule 1: Unassigned photos are always selectable
  if (!photoAssignment) {
    return true
  }

  // Rule 2: Photos assigned to the current feature are always selectable
  if (photoAssignment === targetFeature) {
    return true
  }

  // Rule 3: BUILDING and ADDITIONAL features share their photo pools bidirectionally
  const isBuildingOrAdditional =
    photoAssignment === BUILDING_FEATURE_ID || photoAssignment === ADDITIONAL_FEATURE_ID

  if (targetFeature === BUILDING_FEATURE_ID || targetFeature === ADDITIONAL_FEATURE_ID) {
    return isBuildingOrAdditional
  }

  // Rule 4: Other features can select from BUILDING and ADDITIONAL pools
  return isBuildingOrAdditional
}
