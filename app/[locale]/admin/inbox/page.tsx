import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import Link from "next/link"

export const dynamic = "force-dynamic"

/**
 * /admin/inbox — slice 1+2 minimal landing page.
 *
 * If no Gmail mailbox is connected: a Connect button that kicks off
 * /api/auth/gmail. If a connection exists: a small status block (which
 * mailbox + last sync + how many inbound emails ingested + reply
 * matching count). The full list/detail UI ships in slice 3.
 *
 * Sequences already auto-cancel on reply at this point — the cron
 * (/api/cron/sync-gmail every 5 min) ingests new mail, matches
 * prospects, stamps replied_at, cancels pending drips. No UI required
 * for that loop.
 */
export default async function AdminInboxPage(props: {
  searchParams?: Promise<{ connected?: string; error?: string }>
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

  const { count: inboundCount } = await (supabase as any)
    .from("inbound_emails")
    .select("id", { count: "exact", head: true })

  const { count: matchedCount } = await (supabase as any)
    .from("inbound_emails")
    .select("id", { count: "exact", head: true })
    .not("prospect_id", "is", null)

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
            <ConnectCard />
          ) : (
            <div className="space-y-4">
              {conns.map((c) => (
                <ConnectionStatus key={c.gmail_address} connection={c} />
              ))}
              <ConnectCard label="Connect another mailbox" />
            </div>
          )}

          <div className="mt-8 grid grid-cols-2 gap-4 max-w-md">
            <Stat label="Inbound emails synced" value={inboundCount ?? 0} />
            <Stat label="Matched to a prospect" value={matchedCount ?? 0} />
          </div>

          <p className="mt-8 text-xs text-[#a1a1a0] max-w-xl leading-relaxed">
            The inbox list + detail view ship in the next slice. For now,
            replies are detected and the matching prospects' pending drip
            rows are cancelled automatically — visible on /admin/sales as
            a Replied event in the contact's timeline.
          </p>
        </div>
      </div>
    </div>
  )
}

function ConnectCard({ label = "Connect Gmail" }: { label?: string }) {
  return (
    <div className="rounded-[3px] border border-[#e5e5e4] bg-white p-5 max-w-md">
      <p className="text-sm font-medium text-[#1c1c1a]">Connect a mailbox</p>
      <p className="mt-1 text-xs text-[#6b6b68] leading-relaxed">
        Authorise Arco to read and send replies from your Gmail. Tokens
        are stored encrypted server-side; nothing leaves the cron job.
      </p>
      <Link
        href="/api/auth/gmail"
        className="mt-3 inline-flex h-9 px-4 items-center text-xs font-medium rounded-[3px] text-white"
        style={{ background: "var(--primary, #016D75)" }}
      >
        {label}
      </Link>
    </div>
  )
}

function ConnectionStatus({
  connection,
}: {
  connection: {
    gmail_address: string
    last_sync_at: string | null
    last_history_id: string | null
    last_sync_error: string | null
  }
}) {
  const lastSync = connection.last_sync_at
    ? new Date(connection.last_sync_at).toLocaleString()
    : "never"
  return (
    <div className="rounded-[3px] border border-[#e5e5e4] bg-white p-4 max-w-xl">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-[#1c1c1a]">{connection.gmail_address}</p>
        <span
          className="status-pill"
          style={{
            borderColor: connection.last_sync_error ? "#fecaca" : "#bbf7d0",
            color: connection.last_sync_error ? "#b91c1c" : "#166534",
          }}
        >
          <span
            className={`status-pill-dot ${connection.last_sync_error ? "bg-red-500" : "bg-emerald-500"}`}
          />
          {connection.last_sync_error ? "Error" : "Connected"}
        </span>
      </div>
      <div className="mt-2 text-xs text-[#6b6b68] space-y-0.5">
        <p>Last sync: {lastSync}</p>
        {connection.last_history_id ? (
          <p className="text-[10px] text-[#a1a1a0]">historyId: {connection.last_history_id}</p>
        ) : (
          <p className="text-[10px] text-amber-700">Awaiting first sync run.</p>
        )}
        {connection.last_sync_error && (
          <p className="text-[11px] text-red-700 break-all">Last error: {connection.last_sync_error}</p>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[3px] border border-[#e5e5e4] bg-white p-3">
      <p className="text-[10px] uppercase tracking-wider text-[#a1a1a0]">{label}</p>
      <p className="mt-1 text-xl font-medium text-[#1c1c1a]">{value.toLocaleString()}</p>
    </div>
  )
}
