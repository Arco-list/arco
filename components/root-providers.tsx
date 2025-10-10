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

export interface RootProvidersProps {
  children: ReactNode;
  initialSession: Session | null;
}

export const RootProviders = ({ children, initialSession }: RootProvidersProps) => {
  return (
    <ErrorBoundary>
      <AuthProvider initialSession={initialSession}>
        <ProjectLikesProvider>
          <SavedProjectsProvider>
            <SavedProfessionalsProvider>
              <ScrollToTop />
              {children}
              <Toaster richColors position="top-right" />
            </SavedProfessionalsProvider>
          </SavedProjectsProvider>
        </ProjectLikesProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};
