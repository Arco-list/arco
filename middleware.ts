import { NextResponse, type NextRequest } from "next/server"
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs"

import type { Database } from "@/lib/supabase/types"

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } })

  if (request.nextUrl.pathname.startsWith("/homeowner")) {
    return response
  }

  const supabase = createMiddlewareClient<Database>({ req: request, res: response })

  await supabase.auth.getSession()

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
