"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { signInWithPasswordAction } from "@/app/(auth)/actions";
import { resolveRedirectPath, sanitizeRedirectPath } from "@/lib/auth-redirect";
import { signInWithPasswordSchema, type SignInWithPasswordInput } from "@/lib/supabase/auth-validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";

export interface LoginFormProps {
  redirectTo?: string;
  onSuccess?: () => void;
}

export const LoginForm = ({ redirectTo, onSuccess }: LoginFormProps) => {
  const router = useRouter();
  const [isSubmitting, startTransition] = useTransition();
  const safeRedirectTo = sanitizeRedirectPath(redirectTo);
  const { refreshSession } = useAuth();

  const form = useForm<SignInWithPasswordInput>({
    resolver: zodResolver(signInWithPasswordSchema),
    defaultValues: {
      email: "",
      password: "",
      redirectTo: safeRedirectTo ?? "",
    },
  });

  const handleSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const sanitizedRedirect = sanitizeRedirectPath(values.redirectTo);
      const result = await signInWithPasswordAction({ ...values, redirectTo: sanitizedRedirect });

      if (result?.error) {
        toast.error("Sign in failed", {
          description: result.error.message,
        });
        return;
      }

      if (result?.data?.requiresEmailConfirmation) {
        toast("Confirm your email", {
          description: "We just sent a new confirmation link to your inbox.",
        });

        const query = new URLSearchParams({ email: result.data.email ?? values.email });

        if (sanitizedRedirect) {
          query.set("redirectTo", sanitizedRedirect);
        }

        form.reset({ email: values.email, password: "", redirectTo: sanitizedRedirect ?? "" });
        router.push(`/signup/confirm?${query.toString()}`);
        return;
      }

      toast.success("Signed in successfully");
      const destination = resolveRedirectPath(sanitizedRedirect);
      form.reset({ email: values.email, password: "", redirectTo: sanitizedRedirect ?? "" });

      let sessionRefreshed = true;
      try {
        await refreshSession();
      } catch (error) {
        console.error("Failed to refresh session after sign-in:", error);
        sessionRefreshed = false;
        toast.warning("Signed in, but we're still syncing your session", {
          description: "If the dashboard looks stale, refresh the page.",
        });
      }

      router.push(destination);
      if (!sessionRefreshed) {
        router.refresh();
      }

      onSuccess?.();
    });
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          disabled={isSubmitting}
          {...form.register("email")}
        />
        {form.formState.errors.email && (
          <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          disabled={isSubmitting}
          {...form.register("password")}
        />
        {form.formState.errors.password && (
          <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
        )}
      </div>
      <input type="hidden" defaultValue={safeRedirectTo ?? ""} {...form.register("redirectTo")} />
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
};
