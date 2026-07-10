import { redirect } from "next/navigation"
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import {
  BackfillButton,
  DisconnectButton,
  BoardMappingButton,
  CreateMissingBoardsButton,
  ReconcileOrphansButton,
} from "./client-widgets"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ connected?: string; error?: string }>
}

interface BoardRow {
  id: string
  board_id: string | null
  board_name: string | null
  is_active: boolean
  space_id: string | null
  category_id: string | null
  spaces?: { name: string | null; slug: string | null } | null
  categories?: { name: string | null; slug: string | null } | null
}

async function requireAdmin(): Promise<{ id: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login?redirectTo=/admin/pinterest")
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_types")
    .eq("id", user.id)
    .maybeSingle()
  const types = Array.isArray(profile?.user_types) ? profile!.user_types : []
  if (!types.includes("admin")) redirect("/")
  return { id: user.id }
}

export default async function PinterestAdminPage({ params, searchParams }: PageProps) {
  await requireAdmin()
  const { locale } = await params
  const { connected, error: errorParam } = await searchParams
  const supabase = createServiceRoleSupabaseClient()

  const [{ data: auth }, { data: boards }, { data: recentQueue }, { data: recentPublished }] = await Promise.all([
    supabase.from("pinterest_auth").select("*").eq("id", 1).maybeSingle(),
    supabase
      .from("pinterest_boards")
      .select("id, board_id, board_name, space_id, category_id, is_active, spaces(name, slug), categories(name, slug)")
      .order("board_name"),
    // Pull the last few hundred queue rows so we can group them into
    // sessions (bursts of rows created within a short window — a
    // backfill run, a status transition, etc). 500 covers ~a week of
    // typical traffic; the aggregation happens in JS below.
    supabase
      .from("pinterest_queue")
      .select("id, action, created_at, processed_at, cancelled_at")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("projects")
      .select("id, title, slug, pinterest_pin_id, pinterest_synced_at, pinterest_sync_error, status")
      .not("pinterest_synced_at", "is", null)
      .order("pinterest_synced_at", { ascending: false })
      .limit(20),
  ])

  const isConnected =
    !!auth?.access_token &&
    !!auth?.access_token_expires_at &&
    new Date(auth.access_token_expires_at).getTime() > Date.now()

  const sessions = groupIntoSessions(recentQueue ?? [])
  const typeBoards = ((boards ?? []) as BoardRow[]).filter((b) => b.category_id != null)
  const spaceBoards = ((boards ?? []) as BoardRow[]).filter((b) => b.space_id != null)

  return (
    <div className="min-h-screen bg-white">
      <div className="discover-page-title">
        <div className="wrap">
          {/* Header with pill top-right */}
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="arco-section-title">Pinterest</h3>
              <p className="text-xs text-[#a1a1a0] mt-0.5" style={{ maxWidth: 620 }}>
                Auto-publishes branded pins for every published project — one on the type board (Villa,
                Townhouse…) plus one per non-exterior space (Kitchen, Bathroom…).
              </p>
            </div>
            <ConnectionPill
              isConnected={isConnected}
              expiresAt={auth?.access_token_expires_at ?? null}
              locale={locale}
            />
          </div>

          {/* Flash */}
          {connected === "1" && (
            <div className="mb-4 rounded-[3px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              Pinterest connected. Next cron tick will drain the queue.
            </div>
          )}
          {errorParam && (
            <div className="mb-4 rounded-[3px] border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              Authorisation failed: <code>{decodeURIComponent(errorParam)}</code>
            </div>
          )}

          {/* Connection empty state */}
          {!isConnected && (
            <div className="rounded-[3px] border border-[#e5e5e4] bg-white p-5 max-w-md mb-8">
              <p className="text-sm font-medium text-[#1c1c1a]">Connect Pinterest</p>
              <p className="mt-1 text-xs text-[#6b6b68] leading-relaxed">
                Authorise Arco to publish pins to the arcolist Pinterest account. Tokens are
                stored server-side and refreshed automatically.
              </p>
              <a
                href={`/${locale}/admin/pinterest/oauth/start`}
                className="mt-3 inline-flex h-9 px-4 items-center text-xs font-medium rounded-[3px] text-white"
                style={{ background: "#016D75" }}
              >
                Connect Pinterest
              </a>
            </div>
          )}

          {/* Actions */}
          <div className="mb-8 flex flex-wrap gap-3">
            <BackfillButton />
            <BoardMappingButton
              typeBoards={typeBoards}
              spaceBoards={spaceBoards}
            />
            <CreateMissingBoardsButton />
            <ReconcileOrphansButton />
            {isConnected && <DisconnectButton />}
          </div>

          {/* Sessions */}
          <section className="mb-10">
            <h4 className="arco-label" style={{ marginBottom: 12 }}>Recent sessions</h4>
            <div className="arco-table-wrap">
              <table className="arco-table">
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Started</th>
                    <th style={{ textAlign: "right" }}>Publishes</th>
                    <th style={{ textAlign: "right" }}>Deletes</th>
                    <th style={{ textAlign: "right" }}>Patches</th>
                    <th style={{ textAlign: "right" }}>Processed</th>
                    <th style={{ textAlign: "right" }}>Cancelled</th>
                    <th style={{ textAlign: "right" }}>Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.length === 0 && (
                    <tr><td colSpan={8} style={{ color: "var(--muted)", textAlign: "center", padding: 20 }}>No queue activity yet.</td></tr>
                  )}
                  {sessions.map((s, i) => (
                    <tr key={s.startedAt}>
                      <td>#{sessions.length - i}</td>
                      <td className="arco-table-nowrap">{new Date(s.startedAt).toLocaleString(locale)}</td>
                      <td style={{ textAlign: "right" }}>{s.publishes}</td>
                      <td style={{ textAlign: "right" }}>{s.deletes}</td>
                      <td style={{ textAlign: "right" }}>{s.patches}</td>
                      <td style={{ textAlign: "right", color: s.processed > 0 ? "#166534" : undefined }}>{s.processed}</td>
                      <td style={{ textAlign: "right", color: s.cancelled > 0 ? "#b91c1c" : undefined }}>{s.cancelled}</td>
                      <td style={{ textAlign: "right", color: s.pending > 0 ? "#b45309" : undefined }}>{s.pending}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Recent pins */}
          <section className="mb-10">
            <h4 className="arco-label" style={{ marginBottom: 12 }}>Recent pins</h4>
            <div className="arco-table-wrap">
              <table className="arco-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Pin id</th>
                    <th>Status</th>
                    <th>Synced</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {(recentPublished ?? []).length === 0 && (
                    <tr><td colSpan={5} style={{ color: "var(--muted)", textAlign: "center", padding: 20 }}>No pins synced yet.</td></tr>
                  )}
                  {(recentPublished ?? []).map((p) => (
                    <tr key={p.id}>
                      <td><a href={`/${locale}/projects/${p.slug}`}>{p.title}</a></td>
                      <td className="arco-table-nowrap"><code style={{ fontSize: 11 }}>{p.pinterest_pin_id ?? "—"}</code></td>
                      <td>{p.status}</td>
                      <td className="arco-table-nowrap">{p.pinterest_synced_at ? new Date(p.pinterest_synced_at).toLocaleString(locale) : "—"}</td>
                      <td style={{ color: p.pinterest_sync_error ? "#dc2626" : "var(--muted)", maxWidth: 260, wordBreak: "break-word" }}>{p.pinterest_sync_error ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

// ── Session grouping ─────────────────────────────────────────────────────
// Bucket recent queue rows by created_at into "sessions" — a session is a
// burst of rows enqueued within 5 min of each other. Backfills, project-
// status transitions, and feature edits each present as a distinct
// session because their triggers fire in a tight window.
interface Session {
  startedAt: string
  publishes: number
  deletes: number
  patches: number
  processed: number
  cancelled: number
  pending: number
  total: number
}

interface QueueRow {
  action: string
  created_at: string
  processed_at: string | null
  cancelled_at: string | null
}

function groupIntoSessions(rows: QueueRow[]): Session[] {
  if (rows.length === 0) return []
  // Rows come newest-first from the query; walk them, opening a new
  // session whenever the gap to the next row exceeds SESSION_GAP_MS.
  const SESSION_GAP_MS = 5 * 60 * 1000
  const sessions: Session[] = []
  let current: Session | null = null
  let lastTs = 0

  for (const row of rows) {
    const ts = new Date(row.created_at).getTime()
    if (!current || Math.abs(lastTs - ts) > SESSION_GAP_MS) {
      current = {
        startedAt: row.created_at,
        publishes: 0,
        deletes: 0,
        patches: 0,
        processed: 0,
        cancelled: 0,
        pending: 0,
        total: 0,
      }
      sessions.push(current)
    }
    current.total++
    if (row.action === "publish") current.publishes++
    else if (row.action === "delete") current.deletes++
    else if (row.action === "patch") current.patches++
    if (row.processed_at) current.processed++
    else if (row.cancelled_at) current.cancelled++
    else current.pending++
    // Session's startedAt = earliest row in the burst; since rows arrive
    // newest-first, update on every row so the last one wins.
    current.startedAt = row.created_at
    lastTs = ts
  }
  return sessions.slice(0, 10)
}

// ── Connection pill (top-right of header) ────────────────────────────────
function ConnectionPill({
  isConnected,
  expiresAt,
  locale,
}: {
  isConnected: boolean
  expiresAt: string | null
  locale: string
}) {
  if (!isConnected) {
    return (
      <div className="flex items-center gap-2">
        <span className="status-pill" style={{ borderColor: "#e5e5e4", color: "#6b6b68" }}>
          <span className="status-pill-dot" style={{ background: "#a1a1a0" }} />
          Not connected
        </span>
      </div>
    )
  }
  const relative = expiresAt ? formatRelative(expiresAt) : "unknown"
  return (
    <div className="flex items-center gap-2">
      <span
        className="status-pill"
        style={{ borderColor: "#bbf7d0", color: "#166534" }}
      >
        <span className="status-pill-dot" style={{ background: "#10b981" }} />
        Connected
      </span>
      <span className="text-[11px] text-[#a1a1a0]">
        arcolist · token refreshes {relative}
        {expiresAt && ` (${new Date(expiresAt).toLocaleDateString(locale)})`}
      </span>
    </div>
  )
}

function formatRelative(ts: string): string {
  try {
    const ms = new Date(ts).getTime() - Date.now()
    const abs = Math.abs(ms)
    if (abs < 60_000) return "now"
    const m = Math.floor(abs / 60_000)
    if (m < 60) return `${ms > 0 ? "in " : ""}${m}m${ms > 0 ? "" : " ago"}`
    const h = Math.floor(m / 60)
    if (h < 24) return `${ms > 0 ? "in " : ""}${h}h${ms > 0 ? "" : " ago"}`
    const d = Math.floor(h / 24)
    if (d < 60) return `${ms > 0 ? "in " : ""}${d}d${ms > 0 ? "" : " ago"}`
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" })
  } catch {
    return ts
  }
}
