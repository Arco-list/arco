"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams, useRouter } from "next/navigation";

type LoginModalContextValue = {
  isOpen: boolean;
  redirectTo: string | undefined;
  openLoginModal: (redirectTo?: string) => void;
  closeLoginModal: () => void;
};

const LoginModalContext = createContext<LoginModalContextValue | undefined>(undefined);

export const LoginModalProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [redirectTo, setRedirectTo] = useState<string | undefined>(undefined);

  const openLoginModal = useCallback((redirectTo?: string) => {
    setRedirectTo(redirectTo);
    setIsOpen(true);
  }, []);

  const closeLoginModal = useCallback(() => {
    setIsOpen(false);
    setRedirectTo(undefined);
  }, []);

  // Auto-open login modal when redirectTo is in the URL (from middleware redirect)
  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    const redirectParam = searchParams.get("redirectTo");
    if (redirectParam && !isOpen) {
      openLoginModal(redirectParam);
      // Clean up the URL
      const url = new URL(window.location.href);
      url.searchParams.delete("redirectTo");
      url.searchParams.delete("error");
      router.replace(url.pathname + url.search, { scroll: false });
    }
  }, [searchParams, isOpen, openLoginModal, router]);

  const value = useMemo(
    () => ({ isOpen, redirectTo, openLoginModal, closeLoginModal }),
    [isOpen, redirectTo, openLoginModal, closeLoginModal]
  );

  return <LoginModalContext.Provider value={value}>{children}</LoginModalContext.Provider>;
};

export const useLoginModal = () => {
  const context = useContext(LoginModalContext);
  if (!context) {
    throw new Error("useLoginModal must be used within a LoginModalProvider");
  }
  return context;
};
