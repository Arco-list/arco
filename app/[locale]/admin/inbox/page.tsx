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

  return (
    <div className="min-h-screen bg-white">
      <div className="discover-page-title">
        <div className="wrap">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="arco-section-title">Inbox</h3>
              <p className="text-xs text-[#a1a1a0] mt-0.5">
                Inbound replies to outbound sales mail. Replies auto-cancel pending drip sequences.
              </p>
            </div>
            <ConnectionBadge conns={conns} />
          </div>

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

          {conns.length === 0 ? (
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
          ) : (
            <InboxClient initial={initial} initialTab={initialTab} />
          )}

          {conns.length > 0 && (
            <div className="mt-10 pt-6 border-t border-[#e5e5e4]">
              <h4 className="text-[10px] font-medium text-[#a1a1a0] uppercase tracking-wider mb-3">
                Connected mailboxes
              </h4>
              <div className="space-y-2">
                {conns.map((c) => (
                  <ConnectionRow key={c.gmail_address} connection={c} />
                ))}
                <Link
                  href="/api/auth/gmail"
                  className="text-xs text-[#016D75] hover:underline"
                >
                  + Connect another mailbox
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ConnectionBadge({
  conns,
}: {
  conns: Array<{ gmail_address: string; last_sync_at: string | null; last_sync_error: string | null }>
}) {
  if (conns.length === 0) return null
  const anyError = conns.some((c) => c.last_sync_error)
  const lastSyncAt = conns
    .map((c) => c.last_sync_at)
    .filter((s): s is string => Boolean(s))
    .sort()
    .at(-1)
  const lastSyncLabel = lastSyncAt
    ? formatRelative(lastSyncAt)
    : "awaiting first sync"
  return (
    <div className="flex items-center gap-2">
      <span
        className="status-pill"
        style={{
          borderColor: anyError ? "#fecaca" : "#bbf7d0",
          color: anyError ? "#b91c1c" : "#166534",
        }}
      >
        <span className={`status-pill-dot ${anyError ? "bg-red-500" : "bg-emerald-500"}`} />
        {anyError ? "Sync error" : "Connected"}
      </span>
      <span className="text-[11px] text-[#a1a1a0]">
        {conns.length === 1 ? conns[0].gmail_address : `${conns.length} mailboxes`}
        {" · "}last sync {lastSyncLabel}
      </span>
    </div>
  )
}

function ConnectionRow({
  connection,
}: {
  connection: {
    gmail_address: string
    last_sync_at: string | null
    last_history_id: string | null
    last_sync_error: string | null
  }
}) {
  return (
    <div className="flex items-baseline gap-3 text-xs text-[#6b6b68]">
      <span className="font-medium text-[#1c1c1a]">{connection.gmail_address}</span>
      <span>
        last sync{" "}
        {connection.last_sync_at ? formatRelative(connection.last_sync_at) : "never"}
      </span>
      {connection.last_sync_error && (
        <span className="text-red-700 break-all">· {connection.last_sync_error}</span>
      )}
    </div>
  )
}

function formatRelative(ts: string): string {
  try {
    const ms = Date.now() - new Date(ts).getTime()
    if (ms < 60_000) return "just now"
    const m = Math.floor(ms / 60_000)
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    const d = Math.floor(h / 24)
    if (d < 7) return `${d}d ago`
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" })
  } catch {
    return ts
  }
}
