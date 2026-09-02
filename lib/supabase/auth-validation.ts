import { z } from 'zod';

export const emailSchema = z.string().email('Please enter a valid email address.');

export const signInWithPasswordSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required.'),
  redirectTo: z.string().optional(),
});

export const signInWithOtpSchema = z.object({
  email: emailSchema,
  redirectTo: z.string().optional(),
});

export type SignInWithPasswordInput = z.infer<typeof signInWithPasswordSchema>;
export type SignInWithOtpInput = z.infer<typeof signInWithOtpSchema>;
