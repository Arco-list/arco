import { redirect } from "next/navigation"
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import {
  BoardIdInput,
  BackfillButton,
  DisconnectButton,
  RowActions,
  CreateMissingBoardsButton,
} from "./client-widgets"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ connected?: string; error?: string }>
}

async function requireAdmin(): Promise<{ id: string } | never> {
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

  const [{ data: auth }, { data: boards }, { data: queueStats }, { data: recentPublished }] = await Promise.all([
    supabase.from("pinterest_auth").select("*").eq("id", 1).maybeSingle(),
    supabase
      .from("pinterest_boards")
      .select("id, board_id, board_name, space_id, category_id, is_active, spaces(name, slug), categories(name, slug)")
      .order("board_name"),
    supabase
      .from("pinterest_queue")
      .select("action, processed_at, cancelled_at, created_at, attempts"),
    supabase
      .from("projects")
      .select("id, title, slug, pinterest_pin_id, pinterest_synced_at, pinterest_sync_error, status")
      .not("pinterest_synced_at", "is", null)
      .order("pinterest_synced_at", { ascending: false })
      .limit(20),
  ])

  const queueRows = queueStats ?? []
  const pending = queueRows.filter((r) => !r.processed_at && !r.cancelled_at).length
  const processedRecently = queueRows.filter((r) => r.processed_at && new Date(r.processed_at).getTime() > Date.now() - 24 * 3600_000).length
  const cancelledRecently = queueRows.filter((r) => r.cancelled_at && new Date(r.cancelled_at).getTime() > Date.now() - 24 * 3600_000).length

  const isConnected =
    !!auth?.access_token &&
    !!auth?.access_token_expires_at &&
    new Date(auth.access_token_expires_at).getTime() > Date.now()

  const typeBoards = (boards ?? []).filter((b) => b.category_id)
  const spaceBoards = (boards ?? []).filter((b) => b.space_id)

  return (
    <div className="discover-page-title">
      <div className="wrap">
        <div style={{ maxWidth: 1200 }}>
      <h1 className="arco-page-title" style={{ marginBottom: 8 }}>Pinterest</h1>
      <p className="arco-body-text" style={{ marginBottom: 40, maxWidth: 720 }}>
        Auto-publishes branded pins for every published project — one on the
        matching type board (Villa / Townhouse / …) plus one per non-Exterior
        space (Kitchen / Bathroom / …) linked to the same project page.
      </p>

      {connected === "1" && (
        <div className="arco-alert arco-alert--success" style={{ marginBottom: 24 }}>
          Pinterest connected.
        </div>
      )}
      {errorParam && (
        <div className="arco-alert arco-alert--danger" style={{ marginBottom: 24 }}>
          Authorisation failed: <code>{errorParam}</code>
        </div>
      )}

      {/* ── Connection ─────────────────────────────────────────────── */}
      <section style={{ marginBottom: 48 }}>
        <h2 className="arco-section-title" style={{ marginBottom: 16 }}>Connection</h2>
        <div style={{ background: "white", border: "1px solid var(--rule)", borderRadius: 6, padding: 24 }}>
          {isConnected ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div>
                <div className="arco-eyebrow" style={{ color: "#16a34a", marginBottom: 4 }}>Connected</div>
                <p className="arco-small-text" style={{ margin: 0 }}>
                  Access token expires{" "}
                  <strong>{new Date(auth!.access_token_expires_at!).toLocaleString(locale)}</strong>.
                  {" "}Refresh token good until{" "}
                  <strong>{auth!.refresh_token_expires_at ? new Date(auth!.refresh_token_expires_at).toLocaleDateString(locale) : "?"}</strong>.
                </p>
                <p className="arco-small-text" style={{ margin: "6px 0 0", color: "var(--muted)" }}>Scope: <code>{auth?.scope ?? "—"}</code></p>
              </div>
              <DisconnectButton />
            </div>
          ) : (
            <div>
              <p className="arco-body-text" style={{ marginBottom: 12 }}>
                Not connected. Bootstrap the OAuth handshake to grant this environment access to the Arco Pinterest business account.
              </p>
              <a href={`/${locale}/admin/pinterest/oauth/start`} className="btn-primary" style={{ display: "inline-block" }}>
                Connect Pinterest
              </a>
            </div>
          )}
        </div>
      </section>

      {/* ── Queue snapshot ─────────────────────────────────────────── */}
      <section style={{ marginBottom: 48 }}>
        <h2 className="arco-section-title" style={{ marginBottom: 16 }}>Queue</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16, marginBottom: 20 }}>
          <StatCard label="Pending" value={pending} />
          <StatCard label="Processed · 24h" value={processedRecently} />
          <StatCard label="Cancelled · 24h" value={cancelledRecently} tone={cancelledRecently > 0 ? "warn" : undefined} />
        </div>
        <BackfillButton />
      </section>

      {/* ── Board mapping ──────────────────────────────────────────── */}
      <section style={{ marginBottom: 48 }}>
        <h2 className="arco-section-title" style={{ marginBottom: 16 }}>Board mapping</h2>
        <p className="arco-small-text" style={{ marginBottom: 12, color: "var(--muted)" }}>
          Two paths: click <strong>Create missing boards</strong> to let the API create every unmapped board on Pinterest under this account, or create them manually on Pinterest and paste each id below. Empty id = cron skips.
        </p>
        <div style={{ marginBottom: 20 }}>
          <CreateMissingBoardsButton />
        </div>
        <BoardTable title="Type boards" boards={typeBoards as BoardRow[]} labelKey="categories" />
        <div style={{ marginTop: 32 }}>
          <BoardTable title="Space boards" boards={spaceBoards as BoardRow[]} labelKey="spaces" />
        </div>
      </section>

      {/* ── Recent pins ────────────────────────────────────────────── */}
      <section>
        <h2 className="arco-section-title" style={{ marginBottom: 16 }}>Recent pins</h2>
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
                  <td style={{ color: p.pinterest_sync_error ? "#dc2626" : "var(--muted)" }}>{p.pinterest_sync_error ?? "—"}</td>
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

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "warn" | "ok" }) {
  const color = tone === "warn" && value > 0 ? "#dc2626" : "#1c1c1a"
  return (
    <div style={{ background: "white", border: "1px solid var(--rule)", borderRadius: 6, padding: 16 }}>
      <div className="arco-eyebrow" style={{ marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 400, color }}>{value}</div>
    </div>
  )
}

type BoardRow = {
  id: string
  board_id: string | null
  board_name: string | null
  is_active: boolean
  spaces?: { name: string | null; slug: string | null } | null
  categories?: { name: string | null; slug: string | null } | null
}

function BoardTable({ title, boards, labelKey }: { title: string; boards: BoardRow[]; labelKey: "spaces" | "categories" }) {
  return (
    <div>
      <h4 className="arco-label" style={{ marginBottom: 12 }}>{title}</h4>
      <div className="arco-table-wrap">
        <table className="arco-table">
          <thead>
            <tr>
              <th style={{ width: "34%" }}>Board</th>
              <th style={{ width: "24%" }}>Slug</th>
              <th style={{ width: "34%" }}>Pinterest board id</th>
              <th style={{ width: "8%" }}></th>
            </tr>
          </thead>
          <tbody>
            {boards.length === 0 && (
              <tr><td colSpan={4} style={{ color: "var(--muted)", padding: 16 }}>No rows.</td></tr>
            )}
            {boards.map((b) => {
              const target = labelKey === "spaces" ? b.spaces : b.categories
              return (
                <tr key={b.id}>
                  <td>{b.board_name ?? target?.name ?? "—"}</td>
                  <td><code style={{ fontSize: 11 }}>{target?.slug ?? "—"}</code></td>
                  <td><BoardIdInput boardRowId={b.id} initialValue={b.board_id ?? ""} /></td>
                  <td><RowActions boardRowId={b.id} initialValue={b.board_id ?? ""} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
