"use client";

import { useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";

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

  // De terugkeer-URL wordt pas bij het klikken gelezen, uit window. De
  // zoekparameter-hook van Next hier zou, via de providers in de layout,
  // elke pagina tot client-side rendering dwingen en statisch renderen
  // onmogelijk maken. Bij een klik is window er altijd.
  const redirectToLogin = useCallback(() => {
    const target = typeof window === "undefined"
      ? pathname
      : `${window.location.pathname}${window.location.search}`;
    openLoginModal(target);
  }, [openLoginModal, pathname]);

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
