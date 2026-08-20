import { redirect } from "next/navigation"

/** /businesses has no index page of its own — GSC shows it collecting
 *  404s from inbound links. Send visitors (and crawlers) to the
 *  architects landing, the primary business audience. */
export default async function BusinessesIndexRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  redirect(`/${locale}/businesses/architects`)
}
