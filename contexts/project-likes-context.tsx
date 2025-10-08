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

type LikeResult = {
  success: boolean;
  liked?: boolean;
  likesCount?: number;
  requiresAuth?: boolean;
  error?: string;
};

type ProjectLikesContextValue = {
  likedProjectIds: Set<string>;
  likeCounts: Record<string, number>;
  isLoading: boolean;
  error: string | null;
  mutatingProjectIds: Set<string>;
  refresh: () => Promise<void>;
  toggleLike: (projectId: string, options?: { currentCount?: number }) => Promise<LikeResult>;
};

const ProjectLikesContext = createContext<ProjectLikesContextValue | undefined>(undefined);

export const ProjectLikesProvider = ({ children }: { children: ReactNode }) => {
  const { supabase, user } = useAuth();
  const { ensureAuth } = useRequireAuth();
  const [likedProjectIds, setLikedProjectIds] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [mutatingProjectIds, setMutatingProjectIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const setMutating = useCallback((projectId: string, mutating: boolean) => {
    setMutatingProjectIds((previous) => {
      const next = new Set(previous);
      if (mutating) {
        next.add(projectId);
      } else {
        next.delete(projectId);
      }
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!user) {
      setLikedProjectIds(new Set());
      setLikeCounts({});
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("project_likes")
        .select("project_id, created_at")
        .order("created_at", { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      const likedIds = new Set<string>();

      (data ?? []).forEach((row) => {
        if (row.project_id) {
          likedIds.add(row.project_id);
        }
      });

      if (!isMountedRef.current) return;

      setLikedProjectIds(likedIds);
    } catch (refreshError) {
      if (!isMountedRef.current) return;
      const message =
        refreshError instanceof Error ? refreshError.message : "Could not load liked projects right now.";
      setError(message);
      toast.error("Unable to load liked projects", { description: message });
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
      setLikedProjectIds(new Set());
      setLikeCounts({});
      setMutatingProjectIds(new Set());
    }
  }, [user]);

  const toggleLike = useCallback(
    async (projectId: string, options?: { currentCount?: number }): Promise<LikeResult> => {
      if (!projectId) {
        return { success: false, error: "Missing project id." };
      }

      if (!ensureAuth() || !user) {
        toast.info("Sign in to like projects.");
        return { success: false, requiresAuth: true };
      }

      if (mutatingProjectIds.has(projectId)) {
        return { success: false };
      }

      const wasLiked = likedProjectIds.has(projectId);
      const previousLikedIds = new Set(likedProjectIds);
      const previousCount = options?.currentCount ?? likeCounts[projectId] ?? 0;

      setMutating(projectId, true);

      setLikedProjectIds((prev) => {
        const next = new Set(prev);
        if (wasLiked) {
          next.delete(projectId);
        } else {
          next.add(projectId);
        }
        return next;
      });

      setLikeCounts((prev) => ({
        ...prev,
        [projectId]: Math.max(0, wasLiked ? previousCount - 1 : previousCount + 1),
      }));

      try {
        const nextLiked = !wasLiked;

        if (wasLiked) {
          const { error: deleteError } = await supabase
            .from("project_likes")
            .delete()
            .eq("project_id", projectId)
            .eq("user_id", user.id);

          if (deleteError) {
            throw deleteError;
          }
        } else {
          const { error: insertError } = await supabase
            .from("project_likes")
            .upsert({
              project_id: projectId,
              user_id: user.id,
            });

          if (insertError) {
            throw insertError;
          }
        }

        const { data: projectRow, error: countError } = await supabase
          .from("projects")
          .select("likes_count")
          .eq("id", projectId)
          .maybeSingle();

        if (countError) {
          throw countError;
        }

        const latestCount = projectRow?.likes_count ?? Math.max(0, nextLiked ? previousCount + 1 : previousCount - 1);
        const nextCount = Math.max(0, latestCount);

        setLikedProjectIds(() => {
          const next = new Set(previousLikedIds);
          if (nextLiked) {
            next.add(projectId);
          } else {
            next.delete(projectId);
          }
          return next;
        });

        setLikeCounts((prev) => ({
          ...prev,
          [projectId]: nextCount,
        }));

        return { success: true, liked: nextLiked, likesCount: nextCount };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "We could not update your like right now. Please try again.";
        toast.error("Unable to update like", { description: message });
        setLikedProjectIds(previousLikedIds);
        setLikeCounts((prev) => ({
          ...prev,
          [projectId]: previousCount,
        }));
        return { success: false, error: message };
      } finally {
        setMutating(projectId, false);
      }
    },
    [ensureAuth, likeCounts, likedProjectIds, mutatingProjectIds, setMutating, supabase, user],
  );

  const contextValue = useMemo<ProjectLikesContextValue>(
    () => ({
      likedProjectIds,
      likeCounts,
      isLoading,
      error,
      mutatingProjectIds,
      refresh,
      toggleLike,
    }),
    [error, isLoading, likeCounts, likedProjectIds, mutatingProjectIds, refresh, toggleLike],
  );

  return <ProjectLikesContext.Provider value={contextValue}>{children}</ProjectLikesContext.Provider>;
};

export const useProjectLikes = () => {
  const context = useContext(ProjectLikesContext);
  if (!context) {
    throw new Error("useProjectLikes must be used within a ProjectLikesProvider");
  }
  return context;
};
