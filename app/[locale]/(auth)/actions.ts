'use server';

import { headers } from 'next/headers';
import type { Session, User, SignUpWithPasswordCredentials } from '@supabase/supabase-js';
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
  userTypes?: string[] | null;
};

type AuthActionResult<TData> = {
  data?: TData;
  error?: AuthActionError;
};

const normalizeUrl = (value: string | undefined | null) => {
  if (!value) return undefined;
  const trimmedValue = value.trim();
  if (!trimmedValue) return undefined;
  if (/^https?:\/\//i.test(trimmedValue)) {
    return trimmedValue.replace(/\/$/, '');
  }
  return `https://${trimmedValue}`.replace(/\/$/, '');
};

const getBaseUrl = async () => {
  const envUrl = normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (envUrl) return envUrl;

  const headerList = headers();

  const forwardedProto = headerList.get('x-forwarded-proto');
  const protocol = forwardedProto?.split(',')[0]?.trim() || 'https';

  const possibleHosts = [
    headerList.get('x-forwarded-host'),
    headerList.get('x-vercel-forwarded-host'),
    headerList.get('host'),
  ];

  for (const rawHost of possibleHosts) {
    const host = rawHost?.split(',')[0]?.trim();
    if (host) {
      return `${protocol}://${host}`.replace(/\/$/, '');
    }
  }

  const vercelUrl =
    normalizeUrl(process.env.NEXT_PUBLIC_VERCEL_URL) || normalizeUrl(process.env.VERCEL_URL);
  if (vercelUrl) return vercelUrl;

  return 'http://localhost:3000';
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

  let profileUserTypes: string[] | null = null;
  const userId = data.user?.id;

  if (userId) {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('user_types')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      logger.db(
        'select',
        'profiles',
        'Failed to load user types during password sign-in',
        {
          scope: 'auth-signin',
          userId,
          profileError: {
            message: profileError.message,
            code: profileError.code,
          },
        },
        new Error(profileError.message)
      );
    } else {
      profileUserTypes = profileData?.user_types ?? null;
    }
  }

  return {
    data: {
      session: data.session,
      user: data.user,
      redirectTo,
      userTypes: profileUserTypes,
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

  const { firstName, lastName, email, password, redirectTo: rawRedirectTo, invitedEmail, preferredLanguage } = parseResult.data;
  const redirectTo = sanitizeRedirectPath(rawRedirectTo);
  
  // Detect if this is an invited user (must match email exactly and have create-company redirect)
  const isInvitedUser = !!(
    invitedEmail && 
    email === invitedEmail && 
    redirectTo?.includes('/create-company?projectInvite=')
  );
  
  logger.auth('signup', 'Invite detection', {
    requestId,
    isInvitedUser,
    invitedEmail,
    userEmail: email,
    redirectTo,
  });

  // Step 3: Setup redirect URLs
  const baseUrl = await getBaseUrl();
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

  // Step 3.5: Clean up ghost users (created but never confirmed/signed in)
  try {
    const { createServiceRoleSupabaseClient } = await import('@/lib/supabase/server');
    const adminClient = createServiceRoleSupabaseClient();
    const { data: { users: existingUsers } } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    const ghost = existingUsers?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase().trim()
        && !u.email_confirmed_at
        && !u.last_sign_in_at
    );
    if (ghost) {
      logger.auth('signup', 'Removing ghost user before re-creation', { requestId, ghostId: ghost.id });
      await adminClient.from('profiles').delete().eq('id', ghost.id);
      await adminClient.auth.admin.deleteUser(ghost.id);
    }
  } catch (err) {
    logger.auth('signup', 'Ghost cleanup failed (non-fatal)', { requestId }, err as Error);
  }

  // Step 4: Attempt Supabase auth signup
  let authData, authError;
  try {
    const signupOptions: SignUpWithPasswordCredentials['options'] = {
      emailRedirectTo,
      data: {
        first_name: firstName,
        last_name: lastName,
        // Forwarded into raw_user_meta_data → handle_new_user trigger
        // copies it to profiles.preferred_language.
        ...(preferredLanguage ? { preferred_language: preferredLanguage } : {}),
      },
    };
    
    // For invited users, email is already verified via invite token
    // Note: emailRedirectTo=undefined doesn't skip confirmation; actual skip happens via admin API below
    if (isInvitedUser) {
      signupOptions.emailRedirectTo = undefined;
      logger.auth('signup', 'Invited user - will auto-confirm via admin API', { requestId });
    }
    
    const response = await supabase.auth.signUp({
      email,
      password,
      options: signupOptions,
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

  // Step 4.5: Auto-confirm invited users
  if (isInvitedUser && authData?.user && !authData?.session) {
    try {
      // Import the service role client for admin operations
      const { createServiceRoleSupabaseClient } = await import('@/lib/supabase/server');
      const adminClient = await createServiceRoleSupabaseClient();
      
      logger.auth('signup', 'Auto-confirming invited user email', {
        requestId,
        userId: authData.user.id,
      });
      
      // Confirm the user's email using admin API
      const { data: confirmData, error: confirmError } = await adminClient.auth.admin.updateUserById(
        authData.user.id,
        { email_confirm: true }
      );
      
      if (confirmError) {
        logger.auth('signup', 'Failed to auto-confirm invited user', {
          requestId,
          userId: authData.user.id,
          error: confirmError,
        });
        // Don't fail the signup, just log the error - they can confirm manually
      } else {
        logger.auth('signup', 'Successfully auto-confirmed invited user', {
          requestId,
          userId: authData.user.id,
        });
        
        // Try to create a session for the confirmed user
        const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (!sessionError && sessionData?.session) {
          authData.session = sessionData.session;
          authData.user = sessionData.user;
          logger.auth('signup', 'Created session for auto-confirmed invited user', {
            requestId,
            userId: authData.user.id,
          });

          // Match prospect on signup (auto-confirmed invited user)
          try {
            const { cookies } = await import('next/headers');
            const cookieStore = await cookies();
            const prospectRef = cookieStore.get('prospect_ref')?.value ?? null;
            const claimCompanyId = cookieStore.get('prospect_claim_company_id')?.value ?? null;
            const { matchProspectOnSignup } = await import('@/lib/prospect-matching');
            await matchProspectOnSignup(email, authData.user.id, prospectRef, claimCompanyId);
          } catch (err) {
            logger.error("Failed to match prospect on invited signup", { userId: authData.user.id }, err as Error);
          }
        }
      }
    } catch (error) {
      logger.auth('signup', 'Exception during auto-confirmation', {
        requestId,
        userId: authData?.user?.id,
      }, error as Error);
      // Don't fail the signup, just log the error
    }
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
  const baseUrl = await getBaseUrl();
  const callbackUrl = `${baseUrl}/auth/callback`;
  const finalRedirectTo = resolveRedirectPath(rawRedirectTo);
  const emailRedirectTo = `${callbackUrl}?redirect_to=${encodeURIComponent(finalRedirectTo)}`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
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

export const checkUserExistsAction = async (
  email: string
): Promise<AuthActionResult<{ exists: boolean }>> => {
  if (!email || !email.trim()) {
    return { error: { message: 'Email is required', code: 'VALIDATION_ERROR' } };
  }

  try {
    const { createServiceRoleSupabaseClient } = await import('@/lib/supabase/server');
    const adminClient = createServiceRoleSupabaseClient();

    const { data: { users }, error } = await adminClient.auth.admin.listUsers({
      perPage: 1000,
    });

    if (error) {
      logger.auth('check-user', 'Error checking if user exists', {
        error: { message: error.message },
      });
      return { data: { exists: true } };
    }

    const exactMatch = users?.some(
      (u) => u.email?.toLowerCase() === email.toLowerCase().trim()
    );

    return { data: { exists: !!exactMatch } };
  } catch (error) {
    logger.auth('check-user', 'Exception checking user existence', {}, error as Error);
    return { data: { exists: true } };
  }
};

export const signUpWithOtpAction = async (
  rawInput: { email: string; firstName: string; lastName?: string; redirectTo?: string; preferredLanguage?: 'nl' | 'en' }
): Promise<AuthActionResult<{ redirectTo?: string }>> => {
  const { email, firstName, lastName, redirectTo: rawRedirectTo, preferredLanguage } = rawInput;

  if (!email?.trim() || !firstName?.trim()) {
    return { error: { message: 'Email and first name are required.' } };
  }

  const redirectTo = sanitizeRedirectPath(rawRedirectTo);

  try {
    const { createServiceRoleSupabaseClient } = await import('@/lib/supabase/server');
    const adminClient = createServiceRoleSupabaseClient();

    // Step 0: Clean up ghost users (created but never confirmed/signed in)
    const { data: { users: existingUsers } } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    const ghost = existingUsers?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase().trim()
        && !u.email_confirmed_at
        && !u.last_sign_in_at
    );
    if (ghost) {
      logger.auth('signup-otp', 'Removing ghost user before re-creation', { ghostId: ghost.id });
      // Clean up profile and auth user
      await adminClient.from('profiles').delete().eq('id', ghost.id);
      await adminClient.auth.admin.deleteUser(ghost.id);
    }

    // Step 1: Create user via admin API (auto-confirmed, with metadata)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      email_confirm: true,
      user_metadata: {
        first_name: firstName.trim(),
        last_name: lastName?.trim() || null,
        // handle_new_user trigger copies this to profiles.preferred_language
        ...(preferredLanguage ? { preferred_language: preferredLanguage } : {}),
      },
    });

    if (createError) {
      logger.auth('signup-otp', 'Failed to create user via admin API', {
        error: { message: createError.message },
      });

      // If user already exists (confirmed account), fall through to OTP send
      if (
        createError.message?.toLowerCase().includes('already') ||
        createError.message?.toLowerCase().includes('exists') ||
        createError.status === 422
      ) {
        logger.auth('signup-otp', 'User already exists, proceeding with OTP send');
      } else {
        return {
          error: {
            message: 'Could not create your account. Please try again.',
            code: 'CREATE_USER_ERROR',
          },
        };
      }
    } else {
      logger.auth('signup-otp', 'User created via admin API', {
        userId: newUser.user.id,
      });

      // Match prospect on signup (OTP flow — user is auto-confirmed, won't go through auth callback)
      try {
        const { cookies: getCookies } = await import('next/headers');
        const cookieStore = await getCookies();
        const prospectRef = cookieStore.get('prospect_ref')?.value ?? null;
        const claimCompanyId = cookieStore.get('prospect_claim_company_id')?.value ?? null;
        const { matchProspectOnSignup } = await import('@/lib/prospect-matching');
        await matchProspectOnSignup(email, newUser.user.id, prospectRef, claimCompanyId);
      } catch (err) {
        logger.error("Failed to match prospect on OTP signup", { userId: newUser.user.id }, err as Error);
      }
    }

    // Step 2: Send OTP via the standard flow (goes through Loops.so)
    const supabase = await createServerActionSupabaseClient();
    const baseUrl = await getBaseUrl();
    const callbackUrl = `${baseUrl}/auth/callback`;
    const finalRedirectTo = resolveRedirectPath(rawRedirectTo);
    const emailRedirectTo = `${callbackUrl}?redirect_to=${encodeURIComponent(finalRedirectTo)}`;

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo,
      },
    });

    if (otpError) {
      logger.auth('signup-otp', 'Failed to send OTP after user creation', {
        error: { message: otpError.message },
      });
      return {
        error: {
          message: 'Account created but failed to send verification code. Please try signing in.',
          code: 'OTP_SEND_ERROR',
        },
      };
    }

    return { data: { redirectTo } };
  } catch (error) {
    logger.auth('signup-otp', 'Exception during signup with OTP', {}, error as Error);
    return {
      error: {
        message: 'An unexpected error occurred. Please try again.',
        code: 'UNEXPECTED_ERROR',
      },
    };
  }
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

export const resetPasswordAction = async (
  email: string
): Promise<AuthActionResult<{ success: true }>> => {
  if (!email || !email.trim()) {
    return {
      error: {
        message: 'Email is required',
        code: 'VALIDATION_ERROR',
      },
    };
  }

  const supabase = await createServerActionSupabaseClient();
  const baseUrl = await getBaseUrl();
  const redirectTo = `${baseUrl}/update-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  const normalizedError = normalizeError(error);

  if (normalizedError) {
    return { error: normalizedError };
  }

  return { data: { success: true } };
};

export const updateProfileNameAction = async (input: {
  firstName: string;
  lastName: string;
}): Promise<AuthActionResult<{ success: true }>> => {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();

  if (!firstName) {
    return { error: { message: 'First name is required', code: 'VALIDATION_ERROR' } };
  }

  const supabase = await createServerActionSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: { message: 'Not authenticated', code: 'AUTH_ERROR' } };
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      first_name: firstName,
      last_name: lastName || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (updateError) {
    logger.db('update', 'profiles', 'Failed to update profile name', { userId: user.id }, updateError);
    return { error: { message: 'Could not save your name', code: 'DB_ERROR' } };
  }

  return { data: { success: true } };
};
