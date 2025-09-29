'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

import type { Database } from './types';

let browserClient: ReturnType<typeof createClientComponentClient<Database>> | undefined;

export const getBrowserSupabaseClient = () => {
  if (!browserClient) {
    browserClient = createClientComponentClient<Database>();
  }

  return browserClient;
};
