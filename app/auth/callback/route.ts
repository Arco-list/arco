import { NextResponse, type NextRequest } from 'next/server';

import { createRouteHandlerSupabaseClient } from '@/lib/supabase/server';
import { resolveRedirectPath } from '@/lib/auth-redirect';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const redirectTo = resolveRedirectPath(requestUrl.searchParams.get('redirect_to'));
  const callbackId = Math.random().toString(36).substring(7);

  logger.auth('callback', 'Auth callback started', {
    callbackId,
    hasCode: !!code,
    redirectTo,
    url: requestUrl.href,
  });

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

        return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_error`);
      }

      logger.auth('callback', 'Code exchange successful', {
        callbackId,
        userId: data.user?.id,
        hasSession: !!data.session,
        emailConfirmed: data.user?.email_confirmed_at ? true : false,
      });

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

      // Redirect to email confirmation success page with the original redirectTo as a parameter
      const confirmationUrl = new URL('/auth/confirmed', requestUrl.origin);
      confirmationUrl.searchParams.set('redirectTo', redirectTo);

      logger.auth('callback', 'Callback completed successfully, redirecting to confirmation page', {
        callbackId,
        originalRedirectTo: redirectTo,
        confirmationUrl: confirmationUrl.href,
      });

      // Successful authentication - redirect to confirmation page first
      return NextResponse.redirect(confirmationUrl);
    } catch (error) {
      logger.auth('callback', 'Unexpected error during auth callback', { callbackId }, error as Error);
      return NextResponse.redirect(`${requestUrl.origin}/login?error=unexpected_error`);
    }
  }

  logger.auth('callback', 'No code provided in callback', { callbackId });
  // No code provided - redirect to login
  return NextResponse.redirect(`${requestUrl.origin}/login?error=no_code`);
}
