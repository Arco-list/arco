'use server';

import type { Session, User } from '@supabase/supabase-js';
import type { TablesInsert } from '@/lib/supabase/types';

import {
  signInWithOtpSchema,
  signInWithPasswordSchema,
  signUpSchema,
  type SignInWithOtpInput,
  type SignInWithPasswordInput,
  type SignUpInput,
} from '@/lib/supabase/auth-validation';
import { resolveRedirectPath, sanitizeRedirectPath } from '@/lib/auth-redirect';
import { createServerActionSupabaseClient } from '@/lib/supabase/server';
import { logger, sanitizeForLogging } from '@/lib/logger';

type AuthActionError = {
  message: string;
  code?: string;
};

type AuthSessionPayload = {
  session: Session | null;
  user: User | null;
  redirectTo?: string;
  requiresEmailConfirmation?: boolean;
  email?: string;
};

type AuthActionResult<TData> = {
  data?: TData;
  error?: AuthActionError;
};

const normalizeError = (error: { message: string; code?: string } | null): AuthActionError | undefined => {
  if (!error) return undefined;

  return {
    message: error.message,
    code: error.code,
  };
};

const isEmailConfirmationRequiredError = (error: { message: string; code?: string } | null) => {
  if (!error) return false;
  if (error.code === 'email_not_confirmed') return true;
  return error.message.toLowerCase().includes('confirm');
};

export const signInWithPasswordAction = async (
  rawInput: SignInWithPasswordInput
): Promise<AuthActionResult<AuthSessionPayload>> => {
  const parseResult = signInWithPasswordSchema.safeParse(rawInput);

  if (!parseResult.success) {
    return {
      error: {
        message: parseResult.error.errors.map((err) => err.message).join(', '),
      },
    };
  }

  const supabase = await createServerActionSupabaseClient();
  const { email, password, redirectTo: rawRedirectTo } = parseResult.data;
  const redirectTo = sanitizeRedirectPath(rawRedirectTo);

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (isEmailConfirmationRequiredError(error)) {
    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email });

    if (resendError) {
      const normalizedResendError = normalizeError(resendError);
      if (normalizedResendError) {
        return { error: normalizedResendError };
      }
    }

    return {
      data: {
        session: null,
        user: null,
        redirectTo,
        requiresEmailConfirmation: true,
        email,
      },
    };
  }

  const normalizedError = normalizeError(error);

  if (normalizedError) {
    return { error: normalizedError };
  }

  return {
    data: {
      session: data.session,
      user: data.user,
      redirectTo,
    },
  };
};

export const signUpAction = async (
  rawInput: SignUpInput
): Promise<AuthActionResult<AuthSessionPayload>> => {
  const requestId = Math.random().toString(36).substring(7);

  logger.auth('signup', 'Starting signup process', {
    requestId,
    input: sanitizeForLogging(rawInput),
  });

  // Step 1: Validate input
  const parseResult = signUpSchema.safeParse(rawInput);

  if (!parseResult.success) {
    const validationErrors = parseResult.error.errors.map((err) => err.message).join(', ');
    logger.auth('signup', 'Input validation failed', {
      requestId,
      errors: parseResult.error.errors,
      validationErrors,
    });

    return {
      error: {
        message: validationErrors,
      },
    };
  }

  logger.auth('signup', 'Input validation passed', { requestId });

  // Step 2: Initialize Supabase client
  let supabase;
  try {
    supabase = await createServerActionSupabaseClient();
    logger.auth('signup', 'Supabase client created successfully', { requestId });
  } catch (error) {
    logger.auth('signup', 'Failed to create Supabase client', { requestId }, error as Error);
    return {
      error: {
        message: 'Internal server error during initialization',
        code: 'SUPABASE_CLIENT_ERROR',
      },
    };
  }

  const { firstName, lastName, email, password, redirectTo: rawRedirectTo } = parseResult.data;
  const redirectTo = sanitizeRedirectPath(rawRedirectTo);

  // Step 3: Setup redirect URLs
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const callbackUrl = `${baseUrl}/auth/callback`;
  const finalRedirectTo = resolveRedirectPath(rawRedirectTo);
  const emailRedirectTo = `${callbackUrl}?redirect_to=${encodeURIComponent(finalRedirectTo)}`;

  logger.auth('signup', 'Redirect URLs configured', {
    requestId,
    baseUrl,
    callbackUrl,
    finalRedirectTo,
    emailRedirectTo,
    rawRedirectTo,
    userMetadata: {
      first_name: firstName,
      last_name: lastName,
    },
  });

  // Step 4: Attempt Supabase auth signup
  let authData, authError;
  try {
    const response = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      },
    });
    authData = response.data;
    authError = response.error;

    logger.auth('signup', 'Supabase auth.signUp completed', {
      requestId,
      hasUser: !!authData?.user,
      hasSession: !!authData?.session,
      userId: authData?.user?.id,
      userEmail: authData?.user?.email,
      emailConfirmed: authData?.user?.email_confirmed_at ? true : false,
      authError: authError ? {
        message: authError.message,
        status: authError.status,
      } : null,
    });
  } catch (error) {
    logger.auth('signup', 'Supabase auth.signUp threw exception', { requestId }, error as Error);
    return {
      error: {
        message: 'Authentication service error',
        code: 'AUTH_SERVICE_ERROR',
      },
    };
  }

  const normalizedError = normalizeError(authError);

  if (normalizedError) {
    logger.auth('signup', 'Authentication failed', {
      requestId,
      error: normalizedError,
    });
    return { error: normalizedError };
  }

  // Step 5: Verify profile creation (should be handled by trigger)
  if (authData?.user) {
    if (authData?.session) {
      logger.auth('signup', 'User created with immediate session (profile created by trigger)', {
        requestId,
        userId: authData.user.id,
        sessionId: authData.session.access_token.substring(0, 10) + '...',
        emailConfirmed: true,
      });
    } else {
      logger.auth('signup', 'User created without immediate session (email confirmation required)', {
        requestId,
        userId: authData.user.id,
        emailConfirmed: authData.user.email_confirmed_at ? true : false,
      });
    }

    // Verify the profile was created by the trigger
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, user_types')
        .eq('id', authData.user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        logger.db('select', 'profiles', 'Error checking profile after signup', {
          requestId,
          profileError: {
            message: profileError.message,
            code: profileError.code,
          },
        }, new Error(profileError.message));
      } else if (profile) {
        logger.db('select', 'profiles', 'Profile created successfully by trigger', {
          requestId,
          profileData: sanitizeForLogging(profile),
        });
      } else {
        logger.db('select', 'profiles', 'Profile not found after signup - trigger may have failed', {
          requestId,
          userId: authData.user.id,
        });
      }
    } catch (error) {
      logger.db('select', 'profiles', 'Error verifying profile creation', {
        requestId,
      }, error as Error);
    }
  } else {
    logger.auth('signup', 'Unexpected auth response - no user created', {
      requestId,
      authData: sanitizeForLogging(authData),
    });
  }

  logger.auth('signup', 'Signup process completed successfully', {
    requestId,
    hasSession: !!authData?.session,
    requiresEmailConfirmation: !authData?.session,
    redirectTo,
  });

  return {
    data: {
      session: authData?.session || null,
      user: authData?.user || null,
      redirectTo,
    },
  };
};

export const signInWithOtpAction = async (
  rawInput: SignInWithOtpInput
): Promise<AuthActionResult<{ redirectTo?: string }>> => {
  const parseResult = signInWithOtpSchema.safeParse(rawInput);

  if (!parseResult.success) {
    return {
      error: {
        message: parseResult.error.errors.map((err) => err.message).join(', '),
      },
    };
  }

  const supabase = await createServerActionSupabaseClient();
  const { email, redirectTo: rawRedirectTo } = parseResult.data;
  const redirectTo = sanitizeRedirectPath(rawRedirectTo);

  // Create the full redirect URL with our auth callback
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const callbackUrl = `${baseUrl}/auth/callback`;
  const finalRedirectTo = resolveRedirectPath(rawRedirectTo);
  const emailRedirectTo = `${callbackUrl}?redirect_to=${encodeURIComponent(finalRedirectTo)}`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo,
    },
  });

  const normalizedError = normalizeError(error);

  if (normalizedError) {
    return { error: normalizedError };
  }

  return {
    data: { redirectTo },
  };
};

export const signOutAction = async (): Promise<AuthActionResult<{ success: true }>> => {
  const supabase = await createServerActionSupabaseClient();

  const { error } = await supabase.auth.signOut();
  const normalizedError = normalizeError(error);

  if (normalizedError) {
    return { error: normalizedError };
  }

  return { data: { success: true } };
};
