import type { Tables } from "./types"

type ProjectRow = Tables<"projects">

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

export const isProjectRow = (data: unknown): data is ProjectRow =>
  isRecord(data) && "id" in data
