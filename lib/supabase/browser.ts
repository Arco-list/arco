"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./types";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export const getBrowserSupabaseClient = () => {
  if (!browserClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      throw new Error("Missing Supabase environment variables.");
    }

    browserClient = createBrowserClient<Database>(url, anonKey);
  }

  return browserClient;
};
