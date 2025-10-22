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
import { useRouter } from "next/navigation";
import type { AuthError, Session, SupabaseClient, User } from "@supabase/supabase-js";
import { toast } from "sonner";

import { getBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { Database, UserProfile } from "@/lib/supabase/types";
import { buildSession } from "@/lib/auth-utils";

type AuthContextValue = {
  supabase: SupabaseClient<Database>;
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  refreshSession: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const isExpectedAuthMissingError = (error: AuthError | null) => {
  if (!error) {
    return false;
  }

  if (error.code === "AuthSessionMissingError" || error.name === "AuthSessionMissingError") {
    return true;
  }

  const normalizedMessage = error.message?.toLowerCase() ?? "";

  return (
    normalizedMessage.includes("auth session missing") ||
    normalizedMessage.includes("auth session or user missing") ||
    normalizedMessage.includes("session not found")
  );
};

export interface AuthProviderProps {
  children: ReactNode;
  initialSession: Session | null;
}

export const AuthProvider = ({ children, initialSession }: AuthProviderProps) => {
  const router = useRouter();
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const [session, setSession] = useState<Session | null>(initialSession);
  const [isLoading, setIsLoading] = useState<boolean>(!initialSession);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [user, setUser] = useState<User | null>(initialSession?.user ?? null);
  const isMountedRef = useRef(true);

  const fetchProfile = useCallback(
    async (userId?: string | null) => {
      if (!userId) {
        setProfile(null);
        return;
      }

      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();

      if (!isMountedRef.current) return;

      if (error) {
        toast.error("Could not fetch profile", {
          description: error.message,
        });
        setProfile(null);
        return;
      }

      setProfile((data as UserProfile | null) ?? null);
    },
    [supabase]
  );

  useEffect(() => {
    isMountedRef.current = true;

    const hydrateSession = async () => {
      setIsLoading(true);
      const [{ data: sessionData, error: sessionError }, { data: userData, error: userError }] =
        await Promise.all([
          supabase.auth.getSession(),
          supabase.auth.getUser(),
        ]);

      if (!isMountedRef.current) return;

      if (sessionError && !isExpectedAuthMissingError(sessionError)) {
        toast.error("Could not load session", {
          description: sessionError.message,
        });
      }

      if (userError && !isExpectedAuthMissingError(userError)) {
        toast.error("Could not verify user", {
          description: userError.message,
        });
      }

      const sanitizedSession = buildSession(sessionData.session ?? null, userData.user ?? null);

      setSession(sanitizedSession);
      setUser(userData.user ?? null);
      await fetchProfile(userData.user?.id ?? null);
      if (!isMountedRef.current) return;
      setIsLoading(false);
    };

    void hydrateSession();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchProfile, supabase]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      void (async () => {
        // Handle logout event immediately
        if (event === "SIGNED_OUT") {
          setSession(null);
          setUser(null);
          setProfile(null);
          router.push("/");
          router.refresh();
          return;
        }

        const { data: userData } = await supabase.auth.getUser();
        if (!isMountedRef.current) return;

        const sanitizedSession = buildSession(newSession ?? null, userData.user ?? null);

        setSession(sanitizedSession);
        setUser(userData.user ?? null);
        await fetchProfile(userData.user?.id ?? null);
        router.refresh();
      })();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile, supabase, router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      supabase,
      session,
      user,
      profile,
      isLoading,
      refreshSession: async () => {
        const [{ data: sessionData }, { data: userData }] = await Promise.all([
          supabase.auth.getSession(),
          supabase.auth.getUser(),
        ]);

        const sanitizedSession = buildSession(sessionData.session ?? null, userData.user ?? null);

        setSession(sanitizedSession);
        setUser(userData.user ?? null);
        await fetchProfile(userData.user?.id ?? null);
      },
      refreshProfile: async () => {
        await fetchProfile(user?.id ?? null);
      },
    }),
    [fetchProfile, isLoading, profile, session, supabase, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};
