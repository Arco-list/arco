import { redirect } from "next/navigation"

import { DashboardHeader } from "@/components/dashboard-header"
import { Footer } from "@/components/footer"
import { CompanySettingsShell } from "@/components/company-settings/company-settings-shell"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/types"

export default async function CompanySettingsPage() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    throw new Error(userError.message)
  }

  if (!user) {
    redirect("/login?redirectTo=/dashboard/company")
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select(
      `
        id,
        slug,
        name,
        description,
        website,
        status,
        plan_tier,
        plan_expires_at,
        upgrade_eligible,
        logo_url,
        email,
        phone,
        domain,
        address,
        city,
        country,
        services_offered,
        languages,
        certificates,
        primary_service_id
      `
    )
    .eq("owner_id", user.id)
    .maybeSingle()

  if (companyError) {
    throw new Error(companyError.message)
  }

  if (!company) {
    redirect("/create-company")
  }

  const [{ data: socialLinks }, { data: photos }, { data: allCategories }, { data: professional }] = await Promise.all([
    supabase
      .from("company_social_links")
      .select("id, platform, url")
      .eq("company_id", company.id)
      .order("platform"),
    supabase
      .from("company_photos")
      .select("id, url, alt_text, caption, is_cover, order_index")
      .eq("company_id", company.id)
      .order("order_index"),
    supabase
      .from("categories")
      .select("id, name, slug, parent_id, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name"),
    supabase
      .from("professionals")
      .select("id")
      .eq("user_id", user.id)
      .eq("company_id", company.id)
      .maybeSingle(),
  ])

  // Use all categories as service options (no whitelist filtering)
  const serviceOptions = (allCategories ?? [])
    .map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <DashboardHeader />
      <main className="flex-1 px-4 pt-20 pb-8 md:px-8">
        <div className="mx-auto max-w-7xl">
          <CompanySettingsShell
            company={company as CompanyRow}
            socialLinks={socialLinks ?? []}
            photos={photos ?? []}
            services={serviceOptions}
            professionalId={professional?.id ?? null}
          />
        </div>
      </main>
      <Footer maxWidth="max-w-7xl" />
    </div>
  )
}

type CompanyRow = Database["public"]["Tables"]["companies"]["Row"]
