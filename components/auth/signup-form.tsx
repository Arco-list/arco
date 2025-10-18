"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { signUpAction } from "@/app/(auth)/actions";
import { resolveRedirectPath, sanitizeRedirectPath } from "@/lib/auth-redirect";
import { signUpSchema, type SignUpInput } from "@/lib/supabase/auth-validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface SignupFormProps {
  redirectTo?: string;
  onSuccess?: () => void;
}

export const SignupForm = ({ redirectTo, onSuccess }: SignupFormProps) => {
  const router = useRouter();
  const [isSubmitting, startTransition] = useTransition();
  const safeRedirectTo = sanitizeRedirectPath(redirectTo);

  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      redirectTo: safeRedirectTo ?? "",
    },
  });

  const handleSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const sanitizedRedirect = sanitizeRedirectPath(values.redirectTo);
      const result = await signUpAction({ ...values, redirectTo: sanitizedRedirect });

      if (result?.error) {
        toast.error("Sign up failed", {
          description: result.error.message,
        });
        return;
      }

      if (result?.data?.session) {
        toast.success("Account created");
        router.refresh();

        // Redirect to dashboard by default, or use provided redirectTo
        const destination = resolveRedirectPath(sanitizedRedirect);
        router.push(destination);
      } else {
        toast.success("Account created! Check your email to continue", {
          description: "We've sent you a confirmation link to complete your signup.",
        });

        const query = new URLSearchParams({ email: values.email });
        if (sanitizedRedirect) {
          query.set("redirectTo", sanitizedRedirect);
        }

        router.push(`/signup/confirm?${query.toString()}`);
      }

      onSuccess?.();
      form.reset({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        password: "",
        redirectTo: sanitizedRedirect ?? "",
      });
    });
  });

  const passwordValue = form.watch("password");

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="signup-firstName">First name</Label>
          <Input
            id="signup-firstName"
            type="text"
            placeholder="First name"
            autoComplete="given-name"
            disabled={isSubmitting}
            {...form.register("firstName")}
          />
          {form.formState.errors.firstName && (
            <p className="text-sm text-destructive">{form.formState.errors.firstName.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-lastName">Last name</Label>
          <Input
            id="signup-lastName"
            type="text"
            placeholder="Last name"
            autoComplete="family-name"
            disabled={isSubmitting}
            {...form.register("lastName")}
          />
          {form.formState.errors.lastName && (
            <p className="text-sm text-destructive">{form.formState.errors.lastName.message}</p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
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
        <Label htmlFor="signup-password">Password</Label>
        <Input
          id="signup-password"
          type="password"
          placeholder="Use a strong password"
          autoComplete="new-password"
          disabled={isSubmitting}
          {...form.register("password")}
        />
        {form.formState.errors.password && (
          <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
        )}
        {passwordValue && (
          <ul className="text-xs text-muted-foreground space-y-1">
            <li className={/^[\s\S]{7,}$/.test(passwordValue) ? "text-emerald-600" : undefined}>
              • At least 7 characters
            </li>
            <li className={/[0-9]/.test(passwordValue) ? "text-emerald-600" : undefined}>• Includes a number</li>
            <li className={/[!@#$%^&*(),.?":{}|<>]/.test(passwordValue) ? "text-emerald-600" : undefined}>
              • Includes a symbol
            </li>
          </ul>
        )}
      </div>
      <input type="hidden" defaultValue={safeRedirectTo ?? ""} {...form.register("redirectTo")} />
      <Button type="submit" variant="secondary" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
};
