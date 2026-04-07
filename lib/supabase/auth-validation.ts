import { z } from 'zod';

export const emailSchema = z.string().email('Please enter a valid email address.');

const passwordSchema = z
  .string()
  .min(7, 'Password must be at least 7 characters long.')
  .regex(/[0-9]/, 'Password must contain at least one number.')
  .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one symbol.');

export const signInWithPasswordSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required.'),
  redirectTo: z.string().optional(),
});

export const signUpSchema = z.object({
  firstName: z.string().min(1, 'First name is required.').max(50, 'First name must be less than 50 characters.'),
  lastName: z.string().min(1, 'Last name is required.').max(50, 'Last name must be less than 50 characters.'),
  email: emailSchema,
  password: passwordSchema,
  redirectTo: z.string().optional(),
  invitedEmail: z.union([z.string().email(), z.literal('')]).optional(),
});

export const signInWithOtpSchema = z.object({
  email: emailSchema,
  redirectTo: z.string().optional(),
});

export type SignInWithPasswordInput = z.infer<typeof signInWithPasswordSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInWithOtpInput = z.infer<typeof signInWithOtpSchema>;
