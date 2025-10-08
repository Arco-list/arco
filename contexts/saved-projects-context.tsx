"use client";

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
      const { data: rawSaved, error: fetchError } = await supabase
        .from("saved_projects")
        .select("project_id, created_at")
        .order("created_at", { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      const entries = rawSaved ?? [];
      const projectIds = entries.map((entry) => entry.project_id).filter(Boolean);

      let summaries: ProjectSummaryRow[] = [];

      if (projectIds.length > 0) {
        const { data: summariesData, error: summaryError } = await supabase
          .from("mv_project_summary")
          .select(
            "id, slug, title, primary_photo_url, primary_photo_alt, location, likes_count, created_at, updated_at, budget_display",
          )
          .in("id", projectIds);

        if (summaryError) {
          throw summaryError;
        }

        summaries = summariesData ?? [];
      }

      const summaryById = new Map(
        summaries
          .filter((summary): summary is ProjectSummaryRow & { id: string } => isValidProjectSummary(summary))
          .map((summary) => [summary.id as string, summary]),
      );

      if (!isMountedRef.current) {
        return;
      }

      setSavedProjects(
        entries
          .map((entry) => {
            const projectId = entry.project_id;
            if (!projectId) return null;

            const summary = summaryById.get(projectId) ?? null;

            return {
              projectId,
              createdAt: entry.created_at ?? null,
              summary: summary && isValidProjectSummary(summary) ? summary : null,
            } satisfies SavedProjectEntry;
          })
          .filter((entry): entry is SavedProjectEntry => Boolean(entry)),
      );
    } catch (refreshError) {
      if (!isMountedRef.current) return;
      const message =
        refreshError instanceof Error ? refreshError.message : "Could not load saved projects right now.";
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

      if (!ensureAuth()) {
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

        toast.success("Project saved");
        await refresh();
        return { success: true };
      } catch (saveError) {
        const message =
          saveError instanceof Error ? saveError.message : "We could not save this project. Please try again.";
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

      if (!ensureAuth()) {
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
        const message =
          removeError instanceof Error ? removeError.message : "We could not remove this project right now.";
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
