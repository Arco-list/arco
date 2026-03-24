"use client";

import { useCallback, useMemo, useState } from "react";
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

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setCurrentMode(mode);
  }, [mode, onOpenChange]);

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

  if (!open) return null;

  return (
    <div className="popup-overlay" onClick={handleClose}>
      <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, padding: 0, display: "flex", flexDirection: "column" }}>
        {/* Header — grey background */}
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "20px 28px",
            background: "var(--arco-off-white)", borderRadius: "12px 12px 0 0", flexShrink: 0,
          }}
        >
          <h3 className="arco-section-title" style={{ margin: 0 }}>{title}</h3>
          <button type="button" className="popup-close" onClick={handleClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "12px 28px 28px" }}>
          <p className="arco-body-text" style={{ color: "var(--arco-mid-grey)", marginBottom: 24 }}>
            {description}
          </p>

          {currentMode === "login" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <LoginForm redirectTo={safeRedirectTo} onSuccess={handleClose} />
              <p style={{ fontSize: 13, color: "var(--arco-mid-grey)", textAlign: "center" }}>
                Need an account?{" "}
                <button
                  type="button"
                  onClick={() => setCurrentMode("signup")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--arco-black)", textDecoration: "underline", fontSize: 13 }}
                >
                  Create one
                </button>
              </p>
              <p style={{ fontSize: 13, textAlign: "center" }}>
                <button
                  type="button"
                  onClick={() => setCurrentMode("otp")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--arco-black)", textDecoration: "underline", fontSize: 13 }}
                >
                  Email me a magic link
                </button>
              </p>
            </div>
          )}

          {currentMode === "signup" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <SignupForm redirectTo={safeRedirectTo} onSuccess={handleClose} />
              <p style={{ fontSize: 13, color: "var(--arco-mid-grey)", textAlign: "center" }}>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setCurrentMode("login")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--arco-black)", textDecoration: "underline", fontSize: 13 }}
                >
                  Sign in instead
                </button>
              </p>
            </div>
          )}

          {currentMode === "otp" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <OtpForm redirectTo={safeRedirectTo} onSuccess={handleClose} />
              <p style={{ fontSize: 13, textAlign: "center" }}>
                <button
                  type="button"
                  onClick={() => setCurrentMode("login")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--arco-black)", textDecoration: "underline", fontSize: 13 }}
                >
                  Back to sign in
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
