import 'server-only';

import { cookies } from 'next/headers';
import {
  createRouteHandlerClient,
  createServerActionClient,
  createServerComponentClient,
} from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

import type { Database } from './types';

const getRequiredEnvVar = (key: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY' | 'SUPABASE_SERVICE_ROLE_KEY') => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing ${key} environment variable.`);
  }

  return value;
};

export const createServerSupabaseClient = async () => {
  const cookieStore = await cookies();

  return createServerComponentClient<Database>({
    cookies: () => cookieStore,
  });
};

export const createServerActionSupabaseClient = async () => {
  const cookieStore = await cookies();

  return createServerActionClient<Database>({
    cookies: () => cookieStore,
  });
};

export const createRouteHandlerSupabaseClient = async () => {
  const cookieStore = await cookies();

  return createRouteHandlerClient<Database>({
    cookies: () => cookieStore,
  });
};

export const createServiceRoleSupabaseClient = () => {
  const url = getRequiredEnvVar('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = getRequiredEnvVar('SUPABASE_SERVICE_ROLE_KEY');

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};
