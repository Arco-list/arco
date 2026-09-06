import Link from "next/link"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { fetchInboundEmails, type InboundTab } from "./actions"
import { InboxClient } from "./inbox-client"

export const dynamic = "force-dynamic"

/**
 * /admin/inbox — slice 3 list + detail view.
 *
 *   - Server-fetches the initial page of inbound emails (default tab:
 *     "active" = unread + read) plus the connection-status row(s).
 *   - Renders a compact connection header so the admin sees at a glance
 *     which mailbox is wired and when it last synced.
 *   - The client component (InboxClient) handles tabs, search, the row
 *     popup, mark-as-archived/unread, and re-fetches via the same
 *     server action when filters change.
 *
 * Reply composer is slice 4; AI draft is slice 5.
 */
export default async function AdminInboxPage(props: {
  searchParams?: Promise<{ connected?: string; error?: string; tab?: string }>
}) {
  const params = props.searchParams ? await props.searchParams : {}
  const supabase = createServiceRoleSupabaseClient()

  const { data: connections } = await (supabase as any)
    .from("gmail_connections")
    .select("gmail_address, last_sync_at, last_history_id, last_sync_error")
    .order("created_at", { ascending: true })

  const conns = (connections ?? []) as Array<{
    gmail_address: string
    last_sync_at: string | null
    last_history_id: string | null
    last_sync_error: string | null
  }>

  const initialTab: InboundTab =
    params.tab === "replied" || params.tab === "archived" || params.tab === "all"
      ? params.tab
      : "active"

  const initial = await fetchInboundEmails({ tab: initialTab })

  // Title + connection banners — rendered by the client under the sticky
  // tab bar (company-edit pattern: bar flush against the site header).
  const header = (
    <>
          {params.connected === "1" && (
            <div className="mb-4 rounded-[3px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              Gmail connected. The inbox sync runs every 5 minutes.
            </div>
          )}
          {params.error && (
            <div className="mb-4 rounded-[3px] border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              Connection failed: {decodeURIComponent(params.error)}
            </div>
          )}

    </>
  )

  if (conns.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        <div className="discover-page-title">
          <div className="wrap">
            {/* No tab bar in the connect state, so the title renders
                here instead of in the sticky bar. */}
            <h3 className="arco-section-title mb-1">Inbox</h3>
            {header}
            <div className="rounded-[3px] border border-[#e5e5e4] bg-white p-5 max-w-md">
              <p className="text-sm font-medium text-[#1c1c1a]">Connect a mailbox</p>
              <p className="mt-1 text-xs text-[#6b6b68] leading-relaxed">
                Authorise Arco to read and send replies from your Gmail. Tokens are
                stored encrypted server-side; nothing leaves the cron job.
              </p>
              <Link
                href="/api/auth/gmail"
                className="mt-3 inline-flex h-9 px-4 items-center text-xs font-medium rounded-[3px] text-white"
                style={{ background: "var(--primary, #016D75)" }}
              >
                Connect Gmail
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Connection summary for the status pills in the tab bar: dot+time
  // pill (click = sync now) and mailbox-count pill (click = add).
  const lastSyncAt = conns
    .map((c) => c.last_sync_at)
    .filter((s): s is string => Boolean(s))
    .sort()
    .at(-1) ?? null

  return (
    <div className="min-h-screen bg-white">
      <InboxClient
        initial={initial}
        initialTab={initialTab}
        header={header}
        connCount={conns.length}
        connError={conns.some((c) => c.last_sync_error)}
        connLastSyncAt={lastSyncAt}
      />
    </div>
  )
}


