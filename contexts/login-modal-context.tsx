"use client";

import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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

  const value = useMemo(
    () => ({ isOpen, redirectTo, openLoginModal, closeLoginModal }),
    [isOpen, redirectTo, openLoginModal, closeLoginModal]
  );

  // De URL-watcher staat in een eigen Suspense-grens: useSearchParams in
  // de provider zelf dwong elke pagina (de provider zit in de layout) tot
  // client-side rendering, waardoor geen enkele pagina statisch kon zijn.
  // De watcher rendert niets, dus de fallback is onzichtbaar.
  return (
    <LoginModalContext.Provider value={value}>
      <Suspense fallback={null}>
        <LoginRedirectWatcher isOpen={isOpen} openLoginModal={openLoginModal} />
      </Suspense>
      {children}
    </LoginModalContext.Provider>
  );
};

/** Opent de loginmodal als de middleware met ?redirectTo= terugstuurt, en
 *  haalt die parameter daarna uit de URL. */
function LoginRedirectWatcher({ isOpen, openLoginModal }: { isOpen: boolean; openLoginModal: (redirectTo?: string) => void }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    const redirectParam = searchParams.get("redirectTo");
    if (redirectParam && !isOpen) {
      openLoginModal(redirectParam);
      const url = new URL(window.location.href);
      url.searchParams.delete("redirectTo");
      url.searchParams.delete("error");
      router.replace(url.pathname + url.search, { scroll: false });
    }
  }, [searchParams, isOpen, openLoginModal, router]);
  return null;
}

export const useLoginModal = () => {
  const context = useContext(LoginModalContext);
  if (!context) {
    throw new Error("useLoginModal must be used within a LoginModalProvider");
  }
  return context;
};
