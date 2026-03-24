"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { useAuth } from "@/contexts/auth-context";
import { useLoginModal } from "@/contexts/login-modal-context";

export interface RequireAuthResult {
  isAuthenticated: boolean;
  ensureAuth: () => boolean;
  redirectToLogin: () => void;
}

export const useRequireAuth = (): RequireAuthResult => {
  const { user } = useAuth();
  const { openLoginModal } = useLoginModal();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const redirectTarget = useMemo(() => {
    const search = searchParams?.toString() ?? "";
    return `${pathname}${search ? `?${search}` : ""}`;
  }, [pathname, searchParams]);

  const redirectToLogin = useCallback(() => {
    openLoginModal(redirectTarget);
  }, [openLoginModal, redirectTarget]);

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
