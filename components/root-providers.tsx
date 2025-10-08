"use client";

import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { Toaster } from "sonner";

import { ScrollToTop } from "@/components/scroll-to-top";
import { AuthProvider } from "@/contexts/auth-context";
import { ErrorBoundary } from "@/components/error-boundary";
import { SavedProjectsProvider } from "@/contexts/saved-projects-context";
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
            <ScrollToTop />
            {children}
            <Toaster richColors position="top-right" />
          </SavedProjectsProvider>
        </ProjectLikesProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};
