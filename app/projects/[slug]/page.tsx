import { notFound } from "next/navigation"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Tables } from "@/lib/supabase/types"

const PREVIEW_PARAM = "preview"

const isUuid = (value?: string | null): value is string =>
  !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

const formatDate = (value?: string | null) => {
  if (!value) {
    return null
  }

  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(value))
  } catch (error) {
    return null
  }
}

const capitalizeStatus = (status: string) => status.replace(/_/g, " ")

const stripHtml = (input: string | null | undefined) =>
  input ? input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : null

type ProjectRow = Tables<"projects">
type ProjectPhotoRow = Tables<"project_photos">
type ProjectFeatureRow = Tables<"project_features">
type ProjectProfessionalServiceRow = Tables<"project_professional_services">
type ProjectProfessionalRow = Tables<"project_professionals">
type ProjectCategoryRow = Tables<"project_categories">
type CategoryRow = Tables<"categories">
type TaxonomyOptionRow = Tables<"project_taxonomy_options">

type PageProps = {
  params: { slug: string }
  searchParams?: { [key: string]: string | string[] | undefined }
}

type FeaturePreview = {
  id: string
  name: string
  description: string | null
  photos: Array<{ id: string; url: string }>
}

type ServicePreview = {
  id: string
  name: string
  invites: Array<{ id: string; email: string; status: string }>
}

export default async function ProjectDetailPage({ params, searchParams }: PageProps) {
  const supabase = await createServerSupabaseClient()
  const [{ data: authData }, projectResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("projects")
      .select(
        "id, client_id, title, description, status, project_type, building_type, project_size, budget_level, project_year, building_year, style_preferences, address_city, address_region, share_exact_location, latitude, longitude, slug, created_at, updated_at",
      )
      .eq("slug", params.slug)
      .maybeSingle(),
  ])

  const project = projectResult.data as ProjectRow | null

  if (projectResult.error || !project) {
    notFound()
  }

  const previewRequested = Boolean(searchParams?.[PREVIEW_PARAM])
  const isPublished = project.status === "published"
  const user = authData?.user ?? null

  let isOwner = false
  let isAdmin = false

  if (user) {
    isOwner = project.client_id === user.id

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_types")
      .eq("id", user.id)
      .maybeSingle()

    if (profile?.user_types?.includes("admin")) {
      isAdmin = true
    }
  }

  const canPreview = previewRequested && (isOwner || isAdmin)

  if (!isPublished && !canPreview) {
    notFound()
  }

  const [photosResult, featuresResult, serviceSelectionsResult, projectCategoriesResult, invitesResult] =
    await Promise.all([
      supabase
        .from("project_photos")
        .select("id, url, caption, feature_id, is_primary, order_index")
        .eq("project_id", project.id)
        .order("is_primary", { ascending: false })
        .order("order_index", { ascending: true, nullsFirst: false }),
      supabase
        .from("project_features")
        .select("id, name, description, is_building_default, order_index")
        .eq("project_id", project.id)
        .order("order_index", { ascending: true, nullsFirst: false }),
      supabase
        .from("project_professional_services")
        .select("id, service_category_id")
        .eq("project_id", project.id),
      supabase
        .from("project_categories")
        .select("category_id, is_primary")
        .eq("project_id", project.id),
      supabase
        .from("project_professionals")
        .select("id, invited_email, invited_service_category_id, status")
        .eq("project_id", project.id),
    ])

  const photos = (photosResult.data ?? []) as ProjectPhotoRow[]
  const features = (featuresResult.data ?? []) as ProjectFeatureRow[]
  const serviceSelections = (serviceSelectionsResult.data ?? []) as ProjectProfessionalServiceRow[]
  const invites = (invitesResult.data ?? []) as ProjectProfessionalRow[]
  const projectCategories = (projectCategoriesResult.data ?? []) as ProjectCategoryRow[]

  const categoryIds = new Set<string>()
  const taxonomyIds = new Set<string>()

  if (isUuid(project.project_type)) {
    categoryIds.add(project.project_type)
  }

  projectCategories.forEach((row) => {
    if (isUuid(row.category_id)) {
      categoryIds.add(row.category_id)
    }
  })

  serviceSelections.forEach((row) => {
    if (isUuid(row.service_category_id)) {
      categoryIds.add(row.service_category_id)
    }
  })

  const primaryStyle = project.style_preferences?.[0]
  if (isUuid(primaryStyle)) {
    taxonomyIds.add(primaryStyle)
  }

  if (isUuid(project.building_type)) {
    taxonomyIds.add(project.building_type)
  }

  if (isUuid(project.project_size)) {
    taxonomyIds.add(project.project_size)
  }

  const [categoriesResult, taxonomyResult] = await Promise.all([
    categoryIds.size
      ? supabase
          .from("categories")
          .select("id, name, slug, parent_id")
          .in("id", Array.from(categoryIds))
      : Promise.resolve({ data: [] as CategoryRow[], error: null }),
    taxonomyIds.size
      ? supabase
          .from("project_taxonomy_options")
          .select("id, name, taxonomy_type")
          .in("id", Array.from(taxonomyIds))
      : Promise.resolve({ data: [] as TaxonomyOptionRow[], error: null }),
  ])

  const categoryMap = new Map<string, CategoryRow>()
  ;(categoriesResult.data ?? []).forEach((row) => categoryMap.set(row.id, row))

  const taxonomyMap = new Map<string, TaxonomyOptionRow>()
  ;(taxonomyResult.data ?? []).forEach((row) => taxonomyMap.set(row.id, row))

  const primaryCategoryRow = projectCategories.find((row) => row.is_primary)
  const primaryCategoryName =
    (primaryCategoryRow && categoryMap.get(primaryCategoryRow.category_id)?.name) || null

  const secondaryCategoryName = projectCategories
    .filter((row) => !row.is_primary)
    .map((row) => categoryMap.get(row.category_id)?.name)
    .filter((value): value is string => Boolean(value))
    .join(", ")

  const styleLabel = primaryStyle
    ? taxonomyMap.get(primaryStyle)?.name ?? (isUuid(primaryStyle) ? "" : primaryStyle)
    : ""

  const buildingTypeLabel = project.building_type
    ? taxonomyMap.get(project.building_type)?.name ?? (isUuid(project.building_type) ? "" : project.building_type)
    : ""

  const projectSizeLabel = project.project_size
    ? taxonomyMap.get(project.project_size)?.name ?? (isUuid(project.project_size) ? "" : project.project_size)
    : ""

  const projectTypeLabel = project.project_type
    ? categoryMap.get(project.project_type)?.name ?? (isUuid(project.project_type) ? "" : project.project_type)
    : ""

  const locationLabel = [project.address_city, project.address_region].filter(Boolean).join(", ")

  const coverPhoto = photos.find((photo) => photo.is_primary) ?? (photos.length > 0 ? photos[0] : null)
  const secondaryPhotos = photos.filter((photo) => photo.id !== coverPhoto?.id).slice(0, 4)

  const photosByFeature = photos.reduce<Map<string, Array<{ id: string; url: string }>>>((acc, photo) => {
    if (!photo.feature_id) {
      return acc
    }
    if (!acc.has(photo.feature_id)) {
      acc.set(photo.feature_id, [])
    }
    acc.get(photo.feature_id)!.push({ id: photo.id, url: photo.url })
    return acc
  }, new Map())

  const featurePreviews: FeaturePreview[] = features
    .filter((feature) => !feature.is_building_default)
    .map((feature) => ({
      id: feature.id,
      name: feature.name,
      description: feature.description,
      photos: photosByFeature.get(feature.id) ?? [],
    }))

  const servicePreviews: ServicePreview[] = serviceSelections.map((selection) => {
    const name =
      categoryMap.get(selection.service_category_id)?.name ??
      (isUuid(selection.service_category_id) ? "Unnamed service" : selection.service_category_id)

    const relatedInvites = invites
      .filter((invite) => invite.invited_service_category_id === selection.service_category_id)
      .map((invite) => ({
        id: invite.id,
        email: invite.invited_email,
        status: invite.status,
      }))

    return {
      id: selection.service_category_id,
      name,
      invites: relatedInvites,
    }
  })

  const descriptionText = stripHtml(project.description)
  const createdAt = formatDate(project.created_at)
  const updatedAt = formatDate(project.updated_at)

  return (
    <div className="min-h-screen bg-white">
      {canPreview && <PreviewBanner />}

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-12">
        <HeroGallery coverPhoto={coverPhoto} secondaryPhotos={secondaryPhotos} />

        <ProjectHeader
          title={project.title ?? "Untitled project"}
          subtitle={[styleLabel, projectTypeLabel].filter(Boolean).join(" • ")}
          location={locationLabel}
          category={primaryCategoryName}
          secondaryCategory={secondaryCategoryName}
          status={project.status}
        />

        <DetailsSection
          details={{
            buildingType: buildingTypeLabel,
            size: projectSizeLabel,
            budget: project.budget_level,
            projectYear: project.project_year,
            buildingYear: project.building_year,
            createdAt,
            updatedAt,
            photoCount: photos.length,
          }}
        />

        {descriptionText && <DescriptionSection description={project.description ?? descriptionText} />}

        <ServicesSection services={servicePreviews} />

        <FeaturesSection features={featurePreviews} />

        <LocationSection
          city={project.address_city}
          region={project.address_region}
          shareExactLocation={project.share_exact_location ?? false}
        />
      </main>
    </div>
  )
}

function HeroGallery({
  coverPhoto,
  secondaryPhotos,
}: {
  coverPhoto: ProjectPhotoRow | null
  secondaryPhotos: ProjectPhotoRow[]
}) {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="h-[340px] w-full overflow-hidden rounded-lg bg-gray-100 md:row-span-2">
        {coverPhoto ? (
          <img src={coverPhoto.url} alt="Project cover" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-400">
            <ShieldPlaceholder />
          </div>
        )}
      </div>

      {secondaryPhotos.slice(0, 2).map((photo) => (
        <div key={photo.id} className="h-[160px] overflow-hidden rounded-lg bg-gray-100">
          <img src={photo.url} alt={photo.caption ?? "Project photo"} className="h-full w-full object-cover" />
        </div>
      ))}

      {secondaryPhotos.slice(2, 4).map((photo) => (
        <div key={photo.id} className="h-[160px] overflow-hidden rounded-lg bg-gray-100">
          <img src={photo.url} alt={photo.caption ?? "Project photo"} className="h-full w-full object-cover" />
        </div>
      ))}
    </section>
  )
}

function ProjectHeader({
  title,
  subtitle,
  location,
  category,
  secondaryCategory,
  status,
}: {
  title: string
  subtitle: string
  location: string
  category: string | null
  secondaryCategory: string | null
  status: string
}) {
  return (
    <section className="space-y-4">
      <div className="text-sm text-gray-500">
        Projects
        {category ? (
          <>
            <span className="mx-1">/</span>
            {category}
          </>
        ) : null}
        {secondaryCategory ? (
          <>
            <span className="mx-1">/</span>
            {secondaryCategory}
          </>
        ) : null}
      </div>
      <div className="space-y-2">
        <h1 className="text-4xl font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="text-lg text-gray-600">{subtitle}</p>}
        {location && <p className="text-sm text-gray-500">{location}</p>}
      </div>
      <div className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-4 py-1 text-xs font-medium uppercase tracking-wide text-gray-700">
        {capitalizeStatus(status)}
      </div>
    </section>
  )
}

function DetailsSection({
  details,
}: {
  details: {
    buildingType: string | null
    size: string | null
    budget: ProjectRow["budget_level"] | null
    projectYear: number | null
    buildingYear: number | null
    createdAt: string | null
    updatedAt: string | null
    photoCount: number
  }
}) {
  const items = [
    { label: "Building type", value: details.buildingType },
    { label: "Project size", value: details.size },
    { label: "Budget", value: details.budget },
    { label: "Project year", value: details.projectYear },
    { label: "Building year", value: details.buildingYear },
    { label: "Photos", value: details.photoCount > 0 ? details.photoCount : null },
    { label: "Created", value: details.createdAt },
    { label: "Updated", value: details.updatedAt },
  ].filter((item) => item.value !== null && item.value !== "")

  if (items.length === 0) {
    return null
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Project overview</h2>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="space-y-1 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <dt className="text-xs uppercase tracking-wide text-gray-500">{item.label}</dt>
            <dd className="text-sm font-medium text-gray-900">{item.value as string}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function DescriptionSection({ description }: { description: string }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">About this project</h2>
      <div className="prose max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: description }} />
    </section>
  )
}

function FeaturesSection({ features }: { features: FeaturePreview[] }) {
  if (features.length === 0) {
    return null
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Spaces & features</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {features.map((feature) => (
          <div key={feature.id} className="overflow-hidden rounded-lg border border-gray-200">
            {feature.photos[0] ? (
              <img src={feature.photos[0].url} alt={feature.name} className="h-48 w-full object-cover" />
            ) : (
              <div className="flex h-48 w-full items-center justify-center bg-gray-100 text-gray-400">
                <ShieldPlaceholder />
              </div>
            )}
            <div className="space-y-2 p-4">
              <h3 className="text-lg font-medium text-gray-900">{feature.name}</h3>
              {feature.description && <p className="text-sm text-gray-600">{feature.description}</p>}
              {feature.photos.length > 1 && (
                <p className="text-xs text-gray-500">Includes {feature.photos.length} photos</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function ServicesSection({ services }: { services: ServicePreview[] }) {
  if (services.length === 0) {
    return null
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Professionals involved</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {services.map((service) => (
          <div key={service.id} className="space-y-3 rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-gray-900">{service.name}</p>
              <span className="text-xs uppercase tracking-wide text-gray-500">
                {service.invites.length} invite{service.invites.length === 1 ? "" : "s"}
              </span>
            </div>
            {service.invites.length > 0 ? (
              <ul className="space-y-2 text-sm text-gray-600">
                {service.invites.map((invite) => (
                  <li key={invite.id} className="flex items-center justify-between">
                    <span>{invite.email}</span>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                      {capitalizeStatus(invite.status)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No professionals invited yet.</p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function LocationSection({
  city,
  region,
  shareExactLocation,
}: {
  city: string | null
  region: string | null
  shareExactLocation: boolean
}) {
  if (!city && !region) {
    return null
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-gray-900">Location</h2>
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        <p>{[city, region].filter(Boolean).join(", ")}</p>
        {!shareExactLocation && (
          <p className="mt-1 text-xs text-gray-500">Exact address hidden until homeowner approves sharing.</p>
        )}
      </div>
    </section>
  )
}

function PreviewBanner() {
  return (
    <div className="bg-amber-500/10 py-3 text-sm text-amber-900">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4">
        <p className="font-medium">
          You’re viewing a private preview. Only you and the Arco review team can see this page until the project is
          published.
        </p>
      </div>
    </div>
  )
}

function ShieldPlaceholder() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-10 w-10"
    >
      <path d="M12 3l8 4v5c0 5-3.5 9.74-8 11-4.5-1.26-8-6-8-11V7l8-4z" />
    </svg>
  )
}

export { PREVIEW_PARAM }
