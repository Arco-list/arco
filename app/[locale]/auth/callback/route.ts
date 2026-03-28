import { NextResponse, type NextRequest } from 'next/server';

import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server';
import { resolveRedirectPath } from '@/lib/auth-redirect';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const redirectParam = requestUrl.searchParams.get('redirect_to');
  const redirectTo = resolveRedirectPath(redirectParam);
  const inviteType = requestUrl.searchParams.get('invite');
  const type = requestUrl.searchParams.get('type');
  const message = requestUrl.searchParams.get('message');
  const callbackId = Math.random().toString(36).substring(7);

  logger.auth('callback', 'Auth callback started', {
    callbackId,
    hasCode: !!code,
    hasMessage: !!message,
    redirectTo,
    type,
    url: requestUrl.href,
  });

  // Handle token_hash verification (used by admin "Login as" flow)
  const tokenHash = requestUrl.searchParams.get('token_hash');
  const tokenType = requestUrl.searchParams.get('type');

  if (tokenHash && tokenType) {
    const supabase = await createRouteHandlerSupabaseClient();

    try {
      logger.auth('callback', 'Verifying token_hash', { callbackId, tokenType });

      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: tokenType as any,
      });

      if (error) {
        logger.auth('callback', 'Error verifying token_hash', {
          callbackId,
          error: { message: error.message, status: error.status },
        }, new Error(error.message));
        return NextResponse.redirect(`${requestUrl.origin}/?error=auth_error`);
      }

      logger.auth('callback', 'Token verification successful', {
        callbackId,
        userId: data.user?.id,
        hasSession: !!data.session,
      });

      return NextResponse.redirect(new URL(redirectTo, requestUrl.origin));
    } catch (error) {
      logger.auth('callback', 'Unexpected error during token verification', { callbackId }, error as Error);
      return NextResponse.redirect(`${requestUrl.origin}/?error=unexpected_error`);
    }
  }

  if (code) {
    const supabase = await createRouteHandlerSupabaseClient();

    try {
      logger.auth('callback', 'Exchanging code for session', { callbackId });

      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        logger.auth('callback', 'Error exchanging code for session', {
          callbackId,
          error: {
            message: error.message,
            status: error.status,
          },
        }, new Error(error.message));

        return NextResponse.redirect(`${requestUrl.origin}/?error=auth_error`);
      }

      logger.auth('callback', 'Code exchange successful', {
        callbackId,
        userId: data.user?.id,
        hasSession: !!data.session,
        emailConfirmed: data.user?.email_confirmed_at ? true : false,
      });

      // Handle password recovery flow - redirect directly to update-password page
      if (type === 'recovery' || redirectTo === '/update-password') {
        logger.auth('callback', 'Password recovery detected, redirecting to update-password', {
          callbackId,
          userId: data.user?.id,
        });

        return NextResponse.redirect(`${requestUrl.origin}/update-password`);
      }

      // Check if user has a profile, if not create one (for email confirmation flow)
      if (data.user) {
        logger.db('select', 'profiles', 'Checking for existing profile', {
          callbackId,
          userId: data.user.id,
        });

        const { data: existingProfile, error: selectError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', data.user.id)
          .single();

        if (selectError && selectError.code !== 'PGRST116') {
          logger.db('select', 'profiles', 'Error checking existing profile', {
            callbackId,
            selectError: {
              message: selectError.message,
              code: selectError.code,
            },
          }, new Error(selectError.message));
        }

        if (!existingProfile) {
          logger.db('insert', 'profiles', 'Creating fallback profile for email confirmation', {
            callbackId,
            userId: data.user.id,
          });

          const profileData = {
            id: data.user.id,
            user_types: ['client'] as string[],
          };

          const { data: insertedProfile, error: profileError } = await supabase
            .from('profiles')
            .insert(profileData as any)
            .select()
            .single();

          if (profileError) {
            logger.db('insert', 'profiles', 'Error creating profile in callback', {
              callbackId,
              profileError: {
                message: profileError.message,
                code: profileError.code,
                details: profileError.details,
                hint: profileError.hint,
              },
            }, new Error(profileError.message));

            // Don't fail the callback for profile errors, but log them
          } else {
            logger.db('insert', 'profiles', 'Fallback profile created successfully', {
              callbackId,
              profileId: insertedProfile?.id,
            });
          }
        } else {
          logger.db('select', 'profiles', 'Profile already exists', {
            callbackId,
            profileId: existingProfile.id,
          });
        }
      }

      if (redirectTo.startsWith('/auth/admin-onboarding')) {
        const onboardingUrl = new URL(redirectTo, requestUrl.origin);
        if (redirectParam && !redirectParam.includes('invite=')) {
          onboardingUrl.searchParams.set('invite', inviteType ?? 'admin');
        }
        const inviteEmail = requestUrl.searchParams.get('email');
        if (inviteEmail && !redirectParam?.includes('email=')) {
          onboardingUrl.searchParams.set('email', inviteEmail);
        }

        logger.auth('callback', 'Admin invite detected, redirecting to onboarding flow', {
          callbackId,
          onboardingUrl: onboardingUrl.href,
        });

        return NextResponse.redirect(onboardingUrl);
      }

      // For invite flows, go through the confirmation page
      if (inviteType) {
        const confirmationUrl = new URL('/auth/confirmed', requestUrl.origin);
        confirmationUrl.searchParams.set('redirectTo', redirectTo);
        confirmationUrl.searchParams.set('invite', inviteType);
        if (redirectParam && redirectParam.includes('email=')) {
          confirmationUrl.searchParams.set('inviteEmail', requestUrl.searchParams.get('email') ?? '');
        }

        logger.auth('callback', 'Invite flow, redirecting to confirmation page', {
          callbackId,
          confirmationUrl: confirmationUrl.href,
        });

        return NextResponse.redirect(confirmationUrl);
      }

      // Regular sign-in — redirect directly to the destination
      logger.auth('callback', 'Sign-in successful, redirecting to destination', {
        callbackId,
        redirectTo,
      });

      return NextResponse.redirect(new URL(redirectTo, requestUrl.origin));
    } catch (error) {
      logger.auth('callback', 'Unexpected error during auth callback', { callbackId }, error as Error);
      return NextResponse.redirect(`${requestUrl.origin}/?error=unexpected_error`);
    }
  }

  logger.auth('callback', 'No code provided in callback', { callbackId });
  // No code provided - redirect to login
  return NextResponse.redirect(`${requestUrl.origin}/?error=no_code`);
}
