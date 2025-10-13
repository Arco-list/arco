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

  const [{ data: socialLinks }, { data: photos }, { data: services }, { data: professional }] = await Promise.all([
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
      .select("id, name, slug")
      .eq("is_active", true)
      .is("parent_id", null)
      .order("name"),
    supabase
      .from("professionals")
      .select("id")
      .eq("user_id", user.id)
      .eq("company_id", company.id)
      .maybeSingle(),
  ])

  const serviceOptions = (services ?? []).map((service) => ({
    id: service.id,
    name: service.name,
    slug: service.slug,
  }))

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <DashboardHeader />
      <main className="flex-1 px-4 py-8 md:px-8">
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
      <Footer />
    </div>
  )
}

type CompanyRow = Database["public"]["Tables"]["companies"]["Row"]
