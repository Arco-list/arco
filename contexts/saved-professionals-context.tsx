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
import type { ProfessionalCard } from "@/lib/professionals/types";

const PLACEHOLDER_IMAGE = "/placeholder.svg?height=300&width=300";

type SavedProfessionalEntry = {
  professionalId: string;
  companyId: string | null;
  savedAt: string | null;
  card: ProfessionalCard;
};

type SaveResult = { success: true } | { success: false; error?: string; requiresAuth?: boolean };

type SavedProfessionalsContextValue = {
  savedProfessionals: SavedProfessionalEntry[];
  savedProfessionalIds: Set<string>;
  mutatingProfessionalIds: Set<string>;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  saveProfessional: (professional: ProfessionalCard) => Promise<SaveResult>;
  removeProfessional: (professionalId: string) => Promise<SaveResult>;
};

const SavedProfessionalsContext = createContext<SavedProfessionalsContextValue | undefined>(undefined);

const toProfessionalCard = (row: any): ProfessionalCard => {
  const ratingValue =
    typeof row.display_rating === "number" && !Number.isNaN(row.display_rating) ? row.display_rating : 0;
  const reviewCount =
    typeof row.total_reviews === "number" && !Number.isNaN(row.total_reviews) ? row.total_reviews : 0;

  const specialties = Array.isArray(row.services_offered)
    ? row.services_offered.filter((value: unknown): value is string => typeof value === "string" && value.length > 0)
    : [];

  const name = row.company_name ?? row.title ?? "Professional";
  const profession = row.title ?? row.primary_specialty ?? "Professional";

  const location =
    typeof row.user_location === "string" && row.user_location.length > 0
      ? row.user_location
      : "Location unavailable";

  const image = typeof row.cover_url === "string" && row.cover_url.length > 0
    ? row.cover_url
    : typeof row.logo_url === "string" && row.logo_url.length > 0
      ? row.logo_url
      : PLACEHOLDER_IMAGE;

  return {
    id: row.professional_id,
    slug: row.company_slug || row.company_id || row.professional_id,
    companyId: row.company_id ?? "",
    name,
    profession,
    location,
    rating: Number(ratingValue.toFixed(2)),
    reviewCount,
    image,
    specialties,
    isVerified: Boolean(row.is_verified),
    domain: row.company_domain ?? null,
  };
};

export const SavedProfessionalsProvider = ({ children }: { children: ReactNode }) => {
  const { supabase, user } = useAuth();
  const { ensureAuth } = useRequireAuth();
  const [savedProfessionals, setSavedProfessionals] = useState<SavedProfessionalEntry[]>([]);
  const [mutatingProfessionalIds, setMutatingProfessionalIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const setProfessionalIsMutating = useCallback((professionalId: string, isMutating: boolean) => {
    setMutatingProfessionalIds((previous) => {
      const next = new Set(previous);
      if (isMutating) {
        next.add(professionalId);
      } else {
        next.delete(professionalId);
      }
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!user) {
      setSavedProfessionals([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase.rpc("get_user_saved_professionals_with_summary");

      if (fetchError) {
        throw fetchError;
      }

      if (!isMountedRef.current) {
        return;
      }

      const list = (data ?? []).map((row: any) => {
        const professionalId = row.professional_id;
        if (!professionalId) {
          return null;
        }

        const card = toProfessionalCard(row);

        return {
          professionalId,
          companyId: row.company_id ?? null,
          savedAt: row.saved_at ?? null,
          card,
        } satisfies SavedProfessionalEntry;
      });

      setSavedProfessionals(list.filter((entry): entry is SavedProfessionalEntry => Boolean(entry)));
    } catch (refreshError) {
      if (!isMountedRef.current) return;
      console.error("Failed to load saved professionals", refreshError);
      const message = "Could not load saved professionals right now.";
      setError(message);
      toast.error("Unable to load saved professionals", { description: message });
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
      setSavedProfessionals([]);
      setMutatingProfessionalIds(new Set());
    }
  }, [user]);

  const saveProfessional = useCallback(
    async (professional: ProfessionalCard): Promise<SaveResult> => {
      if (!professional?.id) {
        return { success: false, error: "Missing professional reference." };
      }

      if (!ensureAuth() || !user?.id) {
        toast.info("Sign in to save professionals for later.");
        return { success: false, requiresAuth: true };
      }

      if (mutatingProfessionalIds.has(professional.id)) {
        return { success: false };
      }

      setProfessionalIsMutating(professional.id, true);

      setSavedProfessionals((previous) => {
        if (previous.some((entry) => entry.professionalId === professional.id)) {
          return previous;
        }

        const optimisticEntry: SavedProfessionalEntry = {
          professionalId: professional.id,
          companyId: professional.companyId ?? null,
          savedAt: new Date().toISOString(),
          card: professional,
        };

        return [optimisticEntry, ...previous];
      });

      try {
        const { error: upsertError } = await supabase.from("saved_professionals").upsert(
          {
            user_id: user.id,
            professional_id: professional.id,
          },
          { onConflict: "user_id,professional_id" },
        );

        if (upsertError) {
          throw upsertError;
        }

        toast.success("Professional saved");
        await refresh();

        return { success: true };
      } catch (saveError) {
        console.error("Failed to save professional", { professionalId: professional.id, error: saveError });
        const message = "We could not save this professional. Please try again.";
        toast.error("Unable to save professional", { description: message });
        setSavedProfessionals((previous) =>
          previous.filter((entry) => entry.professionalId !== professional.id),
        );
        return { success: false, error: message };
      } finally {
        setProfessionalIsMutating(professional.id, false);
      }
    },
    [ensureAuth, mutatingProfessionalIds, refresh, supabase, user, setProfessionalIsMutating],
  );

  const removeProfessional = useCallback(
    async (professionalId: string): Promise<SaveResult> => {
      if (!professionalId) {
        return { success: false, error: "Missing professional reference." };
      }

      if (!ensureAuth() || !user?.id) {
        toast.info("Sign in to manage saved professionals.");
        return { success: false, requiresAuth: true };
      }

      if (mutatingProfessionalIds.has(professionalId)) {
        return { success: false };
      }

      setProfessionalIsMutating(professionalId, true);

      const previousState = savedProfessionals;

      setSavedProfessionals((current) => current.filter((entry) => entry.professionalId !== professionalId));

      try {
        const { error: deleteError } = await supabase
          .from("saved_professionals")
          .delete()
          .match({ user_id: user.id, professional_id: professionalId });

        if (deleteError) {
          throw deleteError;
        }

        toast.success("Professional removed");
        await refresh();

        return { success: true };
      } catch (deleteError) {
        console.error("Failed to remove saved professional", { professionalId, error: deleteError });
        const message = "We could not remove this professional right now.";
        toast.error("Unable to remove professional", { description: message });
        setSavedProfessionals(previousState);
        return { success: false, error: message };
      } finally {
        setProfessionalIsMutating(professionalId, false);
      }
    },
    [ensureAuth, mutatingProfessionalIds, refresh, savedProfessionals, supabase, user, setProfessionalIsMutating],
  );

  const savedProfessionalIds = useMemo(() => {
    return new Set(savedProfessionals.map((entry) => entry.professionalId));
  }, [savedProfessionals]);

  const value = useMemo<SavedProfessionalsContextValue>(
    () => ({
      savedProfessionals,
      savedProfessionalIds,
      mutatingProfessionalIds,
      isLoading,
      error,
      refresh,
      saveProfessional,
      removeProfessional,
    }),
    [
      error,
      isLoading,
      mutatingProfessionalIds,
      removeProfessional,
      refresh,
      saveProfessional,
      savedProfessionalIds,
      savedProfessionals,
    ],
  );

  return <SavedProfessionalsContext.Provider value={value}>{children}</SavedProfessionalsContext.Provider>;
};

export const useSavedProfessionals = () => {
  const context = useContext(SavedProfessionalsContext);
  if (!context) {
    throw new Error("useSavedProfessionals must be used within a SavedProfessionalsProvider");
  }
  return context;
};
