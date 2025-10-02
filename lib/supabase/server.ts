import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "./types";

type EnvKey = "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY" | "SUPABASE_SERVICE_ROLE_KEY";

const getRequiredEnvVar = (key: EnvKey) => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing ${key} environment variable.`);
  }

  return value;
};

const createSupabaseClientWithCookies = async () => {
  const cookieStore = await cookies();
  const url = getRequiredEnvVar("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = getRequiredEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch (error) {
          console.warn("Failed to set authentication cookie:", error);
        }
      },
    },
  });
};

export const createServerSupabaseClient = async () => {
  return createSupabaseClientWithCookies();
};

export const createServerActionSupabaseClient = async () => {
  return createSupabaseClientWithCookies();
};

export const createRouteHandlerSupabaseClient = async () => {
  return createSupabaseClientWithCookies();
};

export const createServiceRoleSupabaseClient = () => {
  const url = getRequiredEnvVar("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getRequiredEnvVar("SUPABASE_SERVICE_ROLE_KEY");

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};
