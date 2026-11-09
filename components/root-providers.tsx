"use client";

import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { Toaster } from "sonner";

import { ScrollToTop } from "@/components/scroll-to-top";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { ErrorBoundary } from "@/components/error-boundary";
import { SavedProjectsProvider } from "@/contexts/saved-projects-context";
import { SavedProfessionalsProvider } from "@/contexts/saved-professionals-context";
import { ProjectLikesProvider } from "@/contexts/project-likes-context";
import { LoginModalProvider } from "@/contexts/login-modal-context";
import { LoginModal } from "@/components/auth/login-modal";
import { CreateCompanyModalProvider } from "@/contexts/create-company-modal-context";
import { CreateCompanyModal } from "@/components/create-company-modal";
import { useFirstTouchStamp } from "@/lib/use-first-touch-stamp";

export interface RootProvidersProps {
  children: ReactNode;
  initialSession: Session | null;
}

// Stamps profiles.first_touch_source once per page-load for signed-in
// users. Idempotent — the server endpoint skips when the column is
// already set, so this is cheap and self-healing if a profile was
// created before the column existed.
function FirstTouchStamper() {
  // De sessie komt uit de AuthProvider (clientkant), niet meer van de
  // server: zo blijft dit werken nu de layout geen sessie meer meegeeft.
  const { session } = useAuth()
  useFirstTouchStamp({ enabled: !!session?.user })
  return null
}

export const RootProviders = ({ children, initialSession }: RootProvidersProps) => {
  return (
    <ErrorBoundary>
      <AuthProvider initialSession={initialSession}>
        <LoginModalProvider>
          <CreateCompanyModalProvider>
            <ProjectLikesProvider>
              <SavedProjectsProvider>
                <SavedProfessionalsProvider>
                  <ScrollToTop />
                  <FirstTouchStamper />
                  {children}
                  <LoginModal />
                  <CreateCompanyModal />
                  <Toaster position="top-center" closeButton toastOptions={{ className: "arco-toast" }} />
                </SavedProfessionalsProvider>
              </SavedProjectsProvider>
            </ProjectLikesProvider>
          </CreateCompanyModalProvider>
        </LoginModalProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};
