/**
 * Allowed values for `companies.specialties` (text[]).
 *
 * Surfaced on photographer profiles + the photographer-variant of the
 * company-edit page. The DB column is unconstrained text[]; values are
 * validated in app code so we can iterate without a migration each time.
 */
export const PHOTOGRAPHER_SPECIALTIES = [
  "Residential",
  "Hospitality",
  "Interior",
  "Architectural",
  "Commercial",
] as const

export type PhotographerSpecialty = (typeof PHOTOGRAPHER_SPECIALTIES)[number]

export const isPhotographerSpecialty = (value: string): value is PhotographerSpecialty =>
  (PHOTOGRAPHER_SPECIALTIES as readonly string[]).includes(value)
