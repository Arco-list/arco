"use client";

import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { Toaster } from "sonner";

import { ScrollToTop } from "@/components/scroll-to-top";
import { AuthProvider } from "@/contexts/auth-context";
import { ErrorBoundary } from "@/components/error-boundary";
import { SavedProjectsProvider } from "@/contexts/saved-projects-context";
import { SavedProfessionalsProvider } from "@/contexts/saved-professionals-context";
import { ProjectLikesProvider } from "@/contexts/project-likes-context";
import { LoginModalProvider } from "@/contexts/login-modal-context";
import { LoginModal } from "@/components/auth/login-modal";
import { CreateCompanyModalProvider } from "@/contexts/create-company-modal-context";
import { CreateCompanyModal } from "@/components/create-company-modal";

export interface RootProvidersProps {
  children: ReactNode;
  initialSession: Session | null;
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
