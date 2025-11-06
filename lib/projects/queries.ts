import "server-only"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import type { Tables } from "@/lib/supabase/types"

const INITIAL_PAGE_SIZE = 12

type ProjectSummaryRow = Tables<"project_search_documents">

export const fetchDiscoverProjects = async (): Promise<ProjectSummaryRow[]> => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from("project_search_documents")
    .select("*")
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(INITIAL_PAGE_SIZE)

  if (error) {
    logger.error("Failed to load projects for discover", { function: "fetchDiscoverProjects", error })
    return []
  }

  return data ?? []
}
