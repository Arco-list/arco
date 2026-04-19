"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { toast } from "sonner";

import { useLoginModal } from "@/contexts/login-modal-context";
import { useAuth } from "@/contexts/auth-context";
import { signInWithOtpAction, signInWithPasswordAction, updateProfileNameAction, checkUserExistsAction, signUpWithOtpAction, resetPasswordAction } from "@/app/(auth)/actions";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser";
import { resolveRedirectPath, sanitizeRedirectPath } from "@/lib/auth-redirect";
import { trackSignup } from "@/lib/tracking";

type Screen = "email" | "name-capture" | "otp" | "password" | "welcome" | "reset-sent";

export function LoginModal() {
  const { isOpen, redirectTo, closeLoginModal } = useLoginModal();
  const { refreshSession, profile } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const locale = useLocale();
  // Capture the URL locale at signup time as the user's preferred email
  // language. middleware.ts pre-resolves this from Accept-Language for
  // first-visit browsers, so by the time someone reaches signup the URL
  // already reflects an explicit (cookie/switcher) or detected preference.
  const preferredLanguage = locale === "nl" || locale === "en" ? locale : undefined;

  const [screen, setScreen] = useState<Screen>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [isSendingOtp, startSendOtp] = useTransition();
  const [isVerifying, startVerify] = useTransition();
  const [isSigningIn, startSignIn] = useTransition();
  const [isSavingName, startSaveName] = useTransition();
  const [isResetting, startReset] = useTransition();
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Store the pending redirect so the welcome screen can use it
  const pendingRedirectRef = useRef<string | undefined>(undefined);

  const currentRedirectTo = redirectTo ?? pathname ?? undefined;

  // Resend cooldown timer (60 seconds)
  const startCooldown = useCallback(() => {
    setResendCooldown(60);
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleClose = () => {
    closeLoginModal();
    setTimeout(() => {
      setScreen("email");
      setEmail("");
      setPassword("");
      setFirstName("");
      setLastName("");
      setIsNewUser(false);
      setOtp(["", "", "", "", "", ""]);
      setResendCooldown(0);
      pendingRedirectRef.current = undefined;
    }, 300);
  };

  /** Complete the sign-in flow: check for name, redirect or show welcome */
  const completeSignIn = async (destination?: string) => {
    await refreshSession();

    // Check if profile has a first name — use fresh data from Supabase
    const { data: { user: freshUser } } = await supabase.auth.getUser();
    if (freshUser) {
      const { data: freshProfile } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("id", freshUser.id)
        .maybeSingle();

      if (!freshProfile?.first_name) {
        // New user — show welcome screen to capture name
        pendingRedirectRef.current = destination;
        setScreen("welcome");
        return;
      }
    }

    // Existing user with name — proceed normally
    toast.success("Signed in successfully");
    if (destination) router.push(destination);
    router.refresh();
    handleClose();
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    startSendOtp(async () => {
      const checkResult = await checkUserExistsAction(email);
      if (checkResult?.error) {
        toast.error("Something went wrong", { description: checkResult.error.message });
        return;
      }

      if (checkResult?.data?.exists) {
        // Existing user: send OTP immediately
        setIsNewUser(false);
        const result = await signInWithOtpAction({ email, redirectTo: currentRedirectTo });
        if (result?.error) {
          toast.error("Failed to send code", { description: result.error.message });
          return;
        }
        startCooldown();
        setScreen("otp");
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
      } else {
        // New user: show name capture screen
        setIsNewUser(true);
        setScreen("name-capture");
      }
    });
  };

  const handleNameCaptureSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) return;
    startSendOtp(async () => {
      const result = await signUpWithOtpAction({
        email,
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        redirectTo: currentRedirectTo,
        preferredLanguage,
      });
      if (result?.error) {
        toast.error("Could not create account", { description: result.error.message });
        return;
      }
      startCooldown();
      setScreen("otp");
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    });
  };

  const handleOtpChange = (index: number, value: string) => {
    // Handle paste of full code into any box
    if (value.length > 1) {
      const chars = value.replace(/\D/g, "").slice(0, 6).split("");
      const newOtp = ["", "", "", "", "", ""];
      chars.forEach((char, i) => { newOtp[i] = char; });
      setOtp(newOtp);
      inputRefs.current[Math.min(chars.length, 5)]?.focus();
      return;
    }
    const cleaned = value.replace(/\D/g, "");
    const newOtp = [...otp];
    newOtp[index] = cleaned;
    setOtp(newOtp);
    if (cleaned && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const token = otp.join("");
    if (token.length < 6) return;
    startVerify(async () => {
      const { error, data: otpData } = await supabase.auth.verifyOtp({ email, token, type: "email" });
      if (error) {
        toast.error("Invalid or expired code", { description: error.message });
        setOtp(["", "", "", "", "", ""]);
        setTimeout(() => inputRefs.current[0]?.focus(), 50);
        return;
      }
      if (isNewUser && otpData?.user?.id) {
        trackSignup(otpData.user.id, "email", "client");
      }
      await completeSignIn(currentRedirectTo);
    });
  };

  const handleResend = () => {
    startSendOtp(async () => {
      const result = await signInWithOtpAction({ email, redirectTo: currentRedirectTo });
      if (result?.error) {
        // Start cooldown on rate limit errors so user sees the countdown
        startCooldown();
        toast.error("Failed to resend code", { description: result.error.message });
        return;
      }
      startCooldown();
      setOtp(["", "", "", "", "", ""]);
      toast.success("Code resent", { description: "Check your inbox for the new code." });
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    startSignIn(async () => {
      const safeRedirect = sanitizeRedirectPath(currentRedirectTo);
      const result = await signInWithPasswordAction({ email, password, redirectTo: safeRedirect });
      if (result?.error) {
        toast.error("Sign in failed", { description: result.error.message });
        return;
      }
      const userTypes = result.data?.userTypes ?? null;
      const isAdmin = Array.isArray(userTypes) && userTypes.includes("admin");
      const destination = safeRedirect ?? (isAdmin ? "/admin" : resolveRedirectPath(safeRedirect));
      await completeSignIn(destination);
    });
  };

  const handleWelcomeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) return;
    startSaveName(async () => {
      const result = await updateProfileNameAction({ firstName, lastName });
      if (result?.error) {
        toast.error("Could not save your name", { description: result.error.message });
        return;
      }
      await refreshSession();
      toast.success("Welcome to Arco!");
      const destination = pendingRedirectRef.current;
      if (destination) router.push(destination);
      router.refresh();
      handleClose();
    });
  };

  const handleOAuthSignIn = async (provider: "google" | "apple") => {
    const callbackBase = `${window.location.origin}/auth/callback`;
    const redirectUrl = currentRedirectTo
      ? `${callbackBase}?redirect_to=${encodeURIComponent(currentRedirectTo)}`
      : callbackBase;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectUrl },
    });
    if (error) toast.error(`Sign in with ${provider} failed`, { description: error.message });
  };

  if (!isOpen) return null;

  const screenTitle =
    screen === "email" ? "Welcome to Arco" :
    screen === "name-capture" ? "Create your account" :
    screen === "otp" ? "Check your email" :
    screen === "password" ? "Sign in" :
    screen === "reset-sent" ? "Reset password" :
    "Welcome to Arco";

  const showBack = screen === "name-capture" || screen === "otp" || screen === "password";

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
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {showBack && (
              <button
                type="button"
                className="popup-close"
                onClick={() => {
                  if (screen === "name-capture") { setScreen("email"); setIsNewUser(false); setFirstName(""); setLastName(""); }
                  else if (screen === "otp") setScreen(isNewUser ? "name-capture" : "email");
                  else if (screen === "password") setScreen("otp");
                }}
                style={{ fontSize: 16, display: "flex" }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 12L6 8L10 4" />
                </svg>
              </button>
            )}
            <h3 className="arco-section-title" style={{ margin: 0 }}>{screenTitle}</h3>
          </div>
          <button type="button" className="popup-close" onClick={handleClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "12px 28px 28px" }}>

          {/* ── Screen 1: Email ── */}
          {screen === "email" && (
            <div>
              <p className="arco-body-text" style={{ color: "var(--arco-mid-grey)", marginBottom: 24, textAlign: "center" }}>
                Sign in or create an account to continue
              </p>

              <form onSubmit={handleEmailSubmit}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--arco-black)" }}>
                    Email address
                  </label>
                  <input
                    type="email"
                    className="form-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    autoComplete="email"
                    autoFocus
                    required
                    style={{ marginBottom: 0 }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSendingOtp || !email.trim()}
                  className="btn-primary"
                  style={{ width: "100%", fontSize: 14, padding: "12px 20px" }}
                >
                  {isSendingOtp ? "Sending code..." : "Continue with Email"}
                </button>
              </form>

              <div style={{ display: "flex", alignItems: "center", margin: "24px 0" }}>
                <div style={{ flex: 1, height: 1, background: "var(--arco-rule)" }} />
                <span style={{ padding: "0 16px", fontSize: 13, color: "var(--arco-mid-grey)" }}>or</span>
                <div style={{ flex: 1, height: 1, background: "var(--arco-rule)" }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => handleOAuthSignIn("google")}
                  className="btn-tertiary"
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontSize: 14, padding: "12px 20px" }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </button>
                {/* Apple login hidden until operational */}
              </div>

              <p style={{ fontSize: 12, fontWeight: 300, fontFamily: "var(--font-sans)", color: "var(--arco-mid-grey)", textAlign: "center", marginTop: 20, lineHeight: 1.5 }}>
                By continuing, you agree to our{" "}
                <Link href="/terms" onClick={handleClose} style={{ color: "var(--arco-black)", textDecoration: "underline" }}>Terms of Service</Link>
                {" "}and{" "}
                <Link href="/privacy" onClick={handleClose} style={{ color: "var(--arco-black)", textDecoration: "underline" }}>Privacy Policy</Link>.
              </p>
            </div>
          )}

          {/* ── Screen 1.5: Name Capture (new users) ── */}
          {screen === "name-capture" && (
            <div>
              <p className="arco-body-text" style={{ color: "var(--arco-mid-grey)", marginBottom: 24, textAlign: "center" }}>
                Enter your name to get started with <strong style={{ color: "var(--arco-black)", fontWeight: 500 }}>{email}</strong>
              </p>

              <form onSubmit={handleNameCaptureSubmit}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--arco-black)" }}>
                      First name
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First name"
                      autoComplete="given-name"
                      autoFocus
                      required
                      style={{ marginBottom: 0 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--arco-black)" }}>
                      Last name
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Last name"
                      autoComplete="family-name"
                      style={{ marginBottom: 0 }}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSendingOtp || !firstName.trim()}
                  className="btn-primary"
                  style={{ width: "100%", fontSize: 14, padding: "12px 20px" }}
                >
                  {isSendingOtp ? "Creating account..." : "Continue"}
                </button>

                <p style={{ fontSize: 12, fontWeight: 300, fontFamily: "var(--font-sans)", color: "var(--arco-mid-grey)", textAlign: "center", marginTop: 16, lineHeight: 1.5 }}>
                  By creating an account, you agree to our{" "}
                  <Link href="/terms" onClick={handleClose} style={{ color: "var(--arco-black)", textDecoration: "underline" }}>Terms of Service</Link>
                  {" "}and{" "}
                  <Link href="/privacy" onClick={handleClose} style={{ color: "var(--arco-black)", textDecoration: "underline" }}>Privacy Policy</Link>.
                </p>
              </form>
            </div>
          )}

          {/* ── Screen 2: OTP ── */}
          {screen === "otp" && (
            <div>
              <p className="arco-body-text" style={{ color: "var(--arco-mid-grey)", marginBottom: 24, textAlign: "center" }}>
                We sent a verification code to <strong style={{ color: "var(--arco-black)", fontWeight: 500 }}>{email}</strong>. Enter the 6-digit code below.
              </p>

              <form onSubmit={handleOtpSubmit}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 24 }}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { inputRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      style={{
                        width: "100%", maxWidth: 52, height: 56, textAlign: "center",
                        fontSize: 22, fontWeight: 500, border: "1px solid var(--arco-rule)",
                        borderRadius: 3, background: "#fff", color: "var(--arco-black)",
                        transition: "border-color 0.15s", outline: "none",
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--arco-black)"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--arco-rule)"; }}
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={isVerifying || otp.join("").length < 6}
                  className="btn-primary"
                  style={{ width: "100%", fontSize: 14, padding: "12px 20px" }}
                >
                  {isVerifying ? "Verifying..." : "Verify Code"}
                </button>
              </form>

              <div style={{ display: "flex", alignItems: "center", margin: "24px 0" }}>
                <div style={{ flex: 1, height: 1, background: "var(--arco-rule)" }} />
                <span style={{ padding: "0 16px", fontSize: 13, color: "var(--arco-mid-grey)" }}>or</span>
                <div style={{ flex: 1, height: 1, background: "var(--arco-rule)" }} />
              </div>

              <p style={{ textAlign: "center", fontSize: 13 }}>
                <button
                  type="button"
                  onClick={() => setScreen("password")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--arco-black)", textDecoration: "underline", fontSize: 13 }}
                >
                  Sign in with password instead
                </button>
              </p>
              <p style={{ textAlign: "center", fontSize: 13, color: "var(--arco-mid-grey)", marginTop: 12 }}>
                Didn&apos;t receive the code?{" "}
                {resendCooldown > 0 ? (
                  <span style={{ fontSize: 13, color: "var(--arco-mid-grey)" }}>
                    Resend in {resendCooldown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={isSendingOtp}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--arco-black)", textDecoration: "underline", fontSize: 13 }}
                  >
                    {isSendingOtp ? "Sending..." : "Resend"}
                  </button>
                )}
              </p>
            </div>
          )}

          {/* ── Screen 3: Password ── */}
          {screen === "password" && (
            <div>
              <p className="arco-body-text" style={{ color: "var(--arco-mid-grey)", marginBottom: 24, textAlign: "center" }}>
                Enter your password for <strong style={{ color: "var(--arco-black)", fontWeight: 500 }}>{email}</strong>
              </p>

              <form onSubmit={handlePasswordSubmit}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--arco-black)" }}>
                    Password
                  </label>
                  <input
                    type="password"
                    className="form-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    autoFocus
                    required
                    disabled={isSigningIn}
                    style={{ marginBottom: 0 }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSigningIn || !password.trim()}
                  className="btn-primary"
                  style={{ width: "100%", fontSize: 14, padding: "12px 20px" }}
                >
                  {isSigningIn ? "Signing in..." : "Sign in"}
                </button>
              </form>

              <p style={{ textAlign: "center", marginTop: 16 }}>
                <button
                  type="button"
                  disabled={isResetting}
                  onClick={() => {
                    startReset(async () => {
                      const result = await resetPasswordAction(email);
                      if (result?.error) {
                        toast.error("Could not send reset email", { description: result.error.message });
                        return;
                      }
                      setScreen("reset-sent");
                    });
                  }}
                  style={{ fontSize: 13, color: "var(--arco-mid-grey)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  {isResetting ? "Sending..." : "Forgot your password?"}
                </button>
              </p>
            </div>
          )}

          {/* ── Screen: Reset link sent ── */}
          {screen === "reset-sent" && (
            <div>
              <p className="arco-body-text" style={{ color: "var(--arco-mid-grey)", marginBottom: 24, textAlign: "center" }}>
                We sent a reset link to <strong style={{ color: "var(--arco-black)", fontWeight: 500 }}>{email}</strong>. Click the link in the email to set a new password.
              </p>

              <button
                type="button"
                onClick={handleClose}
                className="btn-primary"
                style={{ width: "100%", fontSize: 14, padding: "12px 20px" }}
              >
                Done
              </button>
            </div>
          )}

          {/* ── Screen 4: Welcome (name capture for new users) ── */}
          {screen === "welcome" && (
            <div>
              <p className="arco-body-text" style={{ color: "var(--arco-mid-grey)", marginBottom: 24, textAlign: "center" }}>
                What&apos;s your name?
              </p>

              <form onSubmit={handleWelcomeSubmit}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--arco-black)" }}>
                      First name
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First name"
                      autoComplete="given-name"
                      autoFocus
                      required
                      style={{ marginBottom: 0 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--arco-black)" }}>
                      Last name
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Last name"
                      autoComplete="family-name"
                      style={{ marginBottom: 0 }}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSavingName || !firstName.trim()}
                  className="btn-primary"
                  style={{ width: "100%", fontSize: 14, padding: "12px 20px" }}
                >
                  {isSavingName ? "Saving..." : "Continue"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
