import ProjectDetailPage, { PREVIEW_PARAM } from "../[slug]/page"

export default async function VillaUpgradePage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined }
}) {
  return ProjectDetailPage({ params: { slug: "villa-upgrade" }, searchParams })
}

export { PREVIEW_PARAM }
