"use client";

import { trackProjectSaved } from "@/lib/tracking";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/auth-context";
import { useRequireAuth } from "@/hooks/use-require-auth";
import type { Tables } from "@/lib/supabase/types";

type ProjectSummaryRow = Tables<"mv_project_summary">;

const isValidProjectSummary = (
  summary: ProjectSummaryRow | null | undefined,
): summary is ProjectSummaryRow & { id: string } => {
  return Boolean(summary && summary.id);
};

export type SavedProjectEntry = {
  projectId: string;
  createdAt: string | null;
  summary: (ProjectSummaryRow & { id: string }) | null;
};

type SaveResult = { success: true } | { success: false; error?: string; requiresAuth?: boolean };

type SavedProjectsContextValue = {
  savedProjects: SavedProjectEntry[];
  savedProjectIds: Set<string>;
  isLoading: boolean;
  error: string | null;
  mutatingProjectIds: Set<string>;
  refresh: () => Promise<void>;
  saveProject: (projectId: string, summary?: ProjectSummaryRow | null) => Promise<SaveResult>;
  removeProject: (projectId: string) => Promise<SaveResult>;
};

const SavedProjectsContext = createContext<SavedProjectsContextValue | undefined>(undefined);

export const SavedProjectsProvider = ({ children }: { children: ReactNode }) => {
  const { supabase, user } = useAuth();
  const { ensureAuth } = useRequireAuth();
  const [savedProjects, setSavedProjects] = useState<SavedProjectEntry[]>([]);
  const [mutatingProjectIds, setMutatingProjectIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const setProjectIsMutating = useCallback((projectId: string, isMutating: boolean) => {
    setMutatingProjectIds((previous) => {
      const next = new Set(previous);
      if (isMutating) {
        next.add(projectId);
      } else {
        next.delete(projectId);
      }
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!user) {
      setSavedProjects([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use optimized database function to fetch saved projects with summaries in a single query
      // This replaces the N+1 query pattern with a single JOIN query
      const { data: savedProjectsData, error: fetchError } = await supabase.rpc(
        "get_user_saved_projects_with_summary",
      );

      if (fetchError) {
        throw fetchError;
      }

      if (!isMountedRef.current) {
        return;
      }

      const projects = (savedProjectsData ?? []).map((row) => {
        // Map RPC result to ProjectSummaryRow format
        const summary = {
          id: row.id,
          slug: row.slug,
          title: row.title,
          primary_photo_url: row.primary_photo_url,
          primary_photo_alt: row.primary_photo_alt,
          location: row.location,
          likes_count: row.likes_count,
          created_at: row.created_at,
          updated_at: row.updated_at,
          budget_display: row.budget_display,
          // Include taxonomy fields for title construction
          project_type: row.project_type ?? null,
          style_preferences: row.style_preferences ?? null,
          // Add missing fields with null values to match ProjectSummaryRow type
          description: null,
          budget_level: null,
          budget_max: null,
          budget_min: null,
          building_type: null,
          building_year: null,
          client_avatar: null,
          client_first_name: null,
          client_last_name: null,
          features: null,
          is_featured: null,
          pending_applications: null,
          photo_count: null,
          primary_category: null,
          primary_category_color: null,
          primary_category_icon: null,
          primary_category_slug: null,
          project_size: null,
          project_year: null,
          status: null,
          total_applications: null,
          views_count: null,
        } as ProjectSummaryRow & { id: string };

        return {
          projectId: row.id,
          createdAt: row.saved_at,
          summary: isValidProjectSummary(summary) ? summary : null,
        } satisfies SavedProjectEntry;
      });

      setSavedProjects(projects);
    } catch (refreshError) {
      if (!isMountedRef.current) return;
      console.error("Failed to load saved projects", refreshError);
      const message = "Could not load saved projects right now.";
      setError(message);
      toast.error("Unable to load saved projects", { description: message });
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [supabase, user]);

  useEffect(() => {
    isMountedRef.current = true;

    void refresh();

    return () => {
      isMountedRef.current = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (!user) {
      setSavedProjects([]);
      setMutatingProjectIds(new Set());
    }
  }, [user]);

  const saveProject = useCallback(
    async (projectId: string, summary?: ProjectSummaryRow | null): Promise<SaveResult> => {
      if (!projectId) {
        return { success: false, error: "Missing project reference." };
      }

      if (!ensureAuth() || !user?.id) {
        toast.info("Sign in to save projects for later.");
        return { success: false, requiresAuth: true };
      }

      if (mutatingProjectIds.has(projectId)) {
        return { success: false };
      }

      setProjectIsMutating(projectId, true);

      const optimisticCreatedAt = new Date().toISOString();

      setSavedProjects((previous) => {
        if (previous.some((entry) => entry.projectId === projectId)) {
          return previous;
        }

        const normalizedSummary =
          summary && isValidProjectSummary(summary) ? (summary as ProjectSummaryRow & { id: string }) : null;

        return [
          {
            projectId,
            createdAt: optimisticCreatedAt,
            summary: normalizedSummary,
          },
          ...previous,
        ];
      });

      try {
        const { error: insertError } = await supabase.from("saved_projects").upsert(
          {
            user_id: user.id,
            project_id: projectId,
          },
          { onConflict: "user_id,project_id" },
        );

        if (insertError) {
          throw insertError;
        }

        trackProjectSaved(projectId);
        toast.success("Project saved");
        await refresh();
        return { success: true };
      } catch (saveError) {
        console.error("Failed to save project", { projectId, error: saveError });
        const message = "We could not save this project. Please try again.";
        toast.error("Unable to save project", { description: message });
        setSavedProjects((previous) => previous.filter((entry) => entry.projectId !== projectId));
        return { success: false, error: message };
      } finally {
        setProjectIsMutating(projectId, false);
      }
    },
    [mutatingProjectIds, refresh, setProjectIsMutating, supabase, user],
  );

  const removeProject = useCallback(
    async (projectId: string): Promise<SaveResult> => {
      if (!projectId) {
        return { success: false, error: "Missing project reference." };
      }

      if (!ensureAuth() || !user?.id) {
        toast.info("Sign in to manage saved projects.");
        return { success: false, requiresAuth: true };
      }

      if (mutatingProjectIds.has(projectId)) {
        return { success: false };
      }

      setProjectIsMutating(projectId, true);

      const previousState = savedProjects;

      setSavedProjects((current) => current.filter((entry) => entry.projectId !== projectId));

      try {
        const { error: deleteError } = await supabase
          .from("saved_projects")
          .delete()
          .eq("user_id", user.id)
          .eq("project_id", projectId);

        if (deleteError) {
          throw deleteError;
        }

        toast.success("Removed from saved projects");
        await refresh();
        return { success: true };
      } catch (removeError) {
        console.error("Failed to remove saved project", { projectId, error: removeError });
        const message = "We could not remove this project right now.";
        toast.error("Unable to remove project", { description: message });
        setSavedProjects(previousState);
        return { success: false, error: message };
      } finally {
        setProjectIsMutating(projectId, false);
      }
    },
    [mutatingProjectIds, refresh, savedProjects, setProjectIsMutating, supabase, user],
  );

  const savedProjectIds = useMemo(() => {
    return new Set(savedProjects.map((entry) => entry.projectId));
  }, [savedProjects]);

  const contextValue = useMemo<SavedProjectsContextValue>(
    () => ({
      savedProjects,
      savedProjectIds,
      isLoading,
      error,
      mutatingProjectIds,
      refresh,
      saveProject,
      removeProject,
    }),
    [error, isLoading, mutatingProjectIds, refresh, removeProject, saveProject, savedProjectIds, savedProjects],
  );

  return <SavedProjectsContext.Provider value={contextValue}>{children}</SavedProjectsContext.Provider>;
};

export const useSavedProjects = () => {
  const context = useContext(SavedProjectsContext);

  if (!context) {
    throw new Error("useSavedProjects must be used within a SavedProjectsProvider");
  }

  return context;
};
