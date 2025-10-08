"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/contexts/auth-context";

export interface RequireAuthResult {
  isAuthenticated: boolean;
  ensureAuth: () => boolean;
  redirectToLogin: () => void;
}

export const useRequireAuth = (): RequireAuthResult => {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const redirectTarget = useMemo(() => {
    const search = searchParams?.toString() ?? "";
    return `${pathname}${search ? `?${search}` : ""}`;
  }, [pathname, searchParams]);

  const redirectToLogin = useCallback(() => {
    const loginUrl = `/login?redirectTo=${encodeURIComponent(redirectTarget)}`;
    router.push(loginUrl);
  }, [redirectTarget, router]);

  const ensureAuth = useCallback(() => {
    if (user) {
      return true;
    }
    redirectToLogin();
    return false;
  }, [redirectToLogin, user]);

  return useMemo(
    () => ({
      isAuthenticated: Boolean(user),
      ensureAuth,
      redirectToLogin,
    }),
    [ensureAuth, redirectToLogin, user],
  );
};
