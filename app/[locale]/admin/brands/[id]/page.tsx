import { notFound } from "next/navigation"
import { Link } from "@/i18n/navigation"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { BrandDetailClient } from "./brand-detail-client"

export const dynamic = "force-dynamic"

export default async function AdminBrandDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceRoleSupabaseClient()

  const { data: brand } = await supabase
    .from("brands")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (!brand) notFound()

  // Waar is dit merk toegepast? De grove koppeling uit migratie 288 —
  // merk + ruimte, nog zonder product of foto. Dit is de lijst waarop
  // de publieke merkpagina straks gebouwd wordt; tot die er is, staat
  // hij hier.
  const linksPromise = (supabase as any)
    .from("project_brands")
    .select("id, note, status, source, photo_id, projects(id, title, slug, status, address_city), product_families(name), spaces(slug, name)")
    .eq("brand_id", id)
    .order("created_at", { ascending: false })

  // Series, niet producten: de merkenlaag gaat merk → serie → foto.
  // Producten zijn uit deze pagina; de tabel volgt zodra de code weg is.
  const [{ data: families }, { data: projectLinks }] = await Promise.all([
    (supabase as any)
      .from("product_families")
      .select("id, slug, name, description, hero_image_url, designer, launch_year, url")
      .eq("brand_id", id)
      .order("name"),
    linksPromise,
  ])
  const applied = ((projectLinks ?? []) as any[]).filter((l) => l.projects)

  return (
    <div className="min-h-screen bg-white">
      <div className="discover-page-title">
        <div className="wrap">
          <BrandDetailClient
            brand={brand as any}
            families={(families ?? []) as any}
          />

          <section style={{ marginTop: 56, paddingTop: 32, borderTop: "1px solid #e5e5e4" }}>
            <h2 className="arco-section-title" style={{ marginBottom: 6 }}>Applied in projects</h2>
            <p className="arco-body-text" style={{ color: "#8c8c8a", marginBottom: 20, maxWidth: 600 }}>
              Tagged from the project editor (admins only for now). Brand, series and room; which photo comes later.
            </p>
            {applied.length === 0 ? (
              <p className="arco-body-text" style={{ color: "#a1a1a0" }}>Not tagged on any project yet.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8, maxWidth: 820 }}>
                {applied.map((l) => (
                  <li key={l.id} style={{ display: "grid", gridTemplateColumns: "1fr 150px 130px 1fr 110px", gap: 12, alignItems: "center", border: "1px solid #e5e5e4", borderRadius: 4, padding: "10px 12px", fontSize: 13 }}>
                    <Link href={`/dashboard/edit/${l.projects.id}`} style={{ fontWeight: 500, color: "#1c1c1a" }}>
                      {l.projects.title}
                      {l.projects.address_city ? <span style={{ color: "#8c8c8a", fontWeight: 400 }}> · {l.projects.address_city}</span> : null}
                    </Link>
                    <span style={{ color: "#1c1c1a" }}>{l.product_families?.name ?? <span style={{ color: "#a1a1a0" }}>—</span>}</span>
                    <span style={{ color: "#8c8c8a" }}>{l.spaces?.name ?? "—"}</span>
                    <span style={{ color: "#8c8c8a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.note ?? ""}</span>
                    <span className="arco-eyebrow" style={{ color: l.photo_id ? "#016D75" : "#a1a1a0", textAlign: "right" }}>
                      {l.photo_id ? "photo pinned" : l.projects.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
