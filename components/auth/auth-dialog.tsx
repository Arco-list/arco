"use client";

import { useCallback, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LoginForm } from "@/components/auth/login-form";
import { OtpForm } from "@/components/auth/otp-form";
import { SignupForm } from "@/components/auth/signup-form";
import { sanitizeRedirectPath } from "@/lib/auth-redirect";

export type AuthDialogMode = "login" | "signup" | "otp";

export interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: AuthDialogMode;
  redirectTo?: string;
}

export const AuthDialog = ({ open, onOpenChange, mode = "login", redirectTo }: AuthDialogProps) => {
  const [currentMode, setCurrentMode] = useState<AuthDialogMode>(mode);
  const safeRedirectTo = sanitizeRedirectPath(redirectTo);

  const handleClose = useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen);
      if (!nextOpen) {
        setCurrentMode(mode);
      }
    },
    [mode, onOpenChange]
  );

  const { title, description } = useMemo(() => {
    switch (currentMode) {
      case "signup":
        return {
          title: "Create your account",
          description: "Sign up to access saved projects, professionals, and more.",
        };
      case "otp":
        return {
          title: "Magic link",
          description: "Enter your email and we will send you a one-time login link.",
        };
      default:
        return {
          title: "Welcome back",
          description: "Sign in to continue where you left off.",
        };
    }
  }, [currentMode]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {currentMode === "login" && (
          <div className="space-y-4">
            <LoginForm redirectTo={safeRedirectTo} onSuccess={() => handleClose(false)} />
            <div className="body-small text-muted-foreground text-center">
              <span>Need an account? </span>
              <Button
                type="button"
                variant="link"
                className="p-0"
                onClick={() => setCurrentMode("signup")}
              >
                Create one
              </Button>
            </div>
            <div className="text-xs text-muted-foreground text-center">
              <Button
                type="button"
                variant="link"
                className="p-0"
                onClick={() => setCurrentMode("otp")}
              >
                Email me a magic link
              </Button>
            </div>
          </div>
        )}

        {currentMode === "signup" && (
          <div className="space-y-4">
            <SignupForm redirectTo={safeRedirectTo} onSuccess={() => handleClose(false)} />
            <div className="body-small text-muted-foreground text-center">
              <span>Already have an account? </span>
              <Button
                type="button"
                variant="link"
                className="p-0"
                onClick={() => setCurrentMode("login")}
              >
                Sign in instead
              </Button>
            </div>
          </div>
        )}

        {currentMode === "otp" && (
          <div className="space-y-4">
            <OtpForm redirectTo={safeRedirectTo} onSuccess={() => handleClose(false)} />
            <div className="body-small text-muted-foreground text-center">
              <Button
                type="button"
                variant="link"
                className="p-0"
                onClick={() => setCurrentMode("login")}
              >
                Back to sign in
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
