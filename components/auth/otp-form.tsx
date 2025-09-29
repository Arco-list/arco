"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { signInWithOtpAction } from "@/app/(auth)/actions";
import { sanitizeRedirectPath } from "@/lib/auth-redirect";
import { signInWithOtpSchema, type SignInWithOtpInput } from "@/lib/supabase/auth-validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface OtpFormProps {
  redirectTo?: string;
  onSuccess?: () => void;
}

export const OtpForm = ({ redirectTo, onSuccess }: OtpFormProps) => {
  const [isSubmitting, startTransition] = useTransition();
  const safeRedirectTo = sanitizeRedirectPath(redirectTo);

  const form = useForm<SignInWithOtpInput>({
    resolver: zodResolver(signInWithOtpSchema),
    defaultValues: {
      email: "",
      redirectTo: safeRedirectTo ?? "",
    },
  });

  const handleSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const sanitizedRedirect = sanitizeRedirectPath(values.redirectTo);
      const result = await signInWithOtpAction({ ...values, redirectTo: sanitizedRedirect });

      if (result?.error) {
        toast.error("Failed to send magic link", {
          description: result.error.message,
        });
        return;
      }

      toast.success("Magic link sent", {
        description: "Check your email for the sign-in link.",
      });

      onSuccess?.();
    });
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="otp-email">Email</Label>
        <Input
          id="otp-email"
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
      <input type="hidden" defaultValue={safeRedirectTo ?? ""} {...form.register("redirectTo")} />
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Sending magic link..." : "Send magic link"}
      </Button>
    </form>
  );
};
