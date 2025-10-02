import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

import type { Database } from "./types";

type EnvKey = "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY";

const PROTECTED_PATH_PREFIXES = ["/dashboard", "/create-company", "/new-project"];

const getRequiredEnvVar = (key: EnvKey) => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing ${key} environment variable.`);
  }

  return value;
};

export async function updateSession(request: NextRequest) {
  const url = getRequiredEnvVar("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = getRequiredEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const pathname = request.nextUrl.pathname;
  const requiresAuth = PROTECTED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!requiresAuth) {
    try {
      await supabase.auth.getSession();
    } catch (error) {
      console.error("Middleware session refresh failed:", error);
    }
    return response;
  }

  let authenticatedUser: User | null = null;

  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      throw error;
    }
    authenticatedUser = data.user;
  } catch (error) {
    console.error("Middleware auth check failed:", error);
    authenticatedUser = null;
  }

  if (!authenticatedUser) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirectTo", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
