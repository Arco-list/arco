export const PROJECT_TYPE_FILTERS = {
  House: ["House", "Villa", "Apartment", "Chalet", "Bungalow", "Farm", "Extension"],
  "Kitchen & Living": ["Kitchen & Living", "Kitchen", "Living room", "Dining room", "Sunroom"],
  "Bed & Bath": ["Bed & Bath", "Bathroom", "Bedroom", "Indoor Pool", "Jacuzzi", "Sauna", "Steam room"],
  Outdoor: ["Outdoor", "Garden", "Outdoor pool", "Garden house", "Outdoor kitchen", "Garage", "Porch"],
  Other: ["Other", "Hall", "Home office", "Bar", "Cinema", "Gym", "Game room", "Kids room", "Wine cellar"],
} as const

export type ProjectTypeName = keyof typeof PROJECT_TYPE_FILTERS

export const isAllowedProjectType = (name: string): name is ProjectTypeName => {
  return Object.prototype.hasOwnProperty.call(PROJECT_TYPE_FILTERS, name)
}

export const isAllowedProjectSubType = (typeName: string, subTypeName: string) => {
  if (!isAllowedProjectType(typeName)) return false
  return PROJECT_TYPE_FILTERS[typeName].includes(subTypeName)
}
