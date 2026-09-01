import { getTranslations } from "next-intl/server"

import { previewCredit } from "@/lib/invites/accept-credit"

import { AcceptClient } from "./accept-client"

export const dynamic = "force-dynamic"

/**
 * Landing page for the "Accepteer vermelding" link in invite email.
 *
 * The page only READS on load — accepting is an explicit button (a POST
 * through a server action), so a mail scanner following the link cannot
 * make a company's page public on its own.
 */
export default async function InviteAcceptPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ t?: string }>
}) {
  const { locale } = await params
  const { t: token } = await searchParams
  const t = await getTranslations({ locale, namespace: "invite_accept" })

  const preview = await previewCredit(token)

  const copy = {
    accept: t("accept"),
    accepting: t("accepting"),
    viewProject: t("view_project"),
    acceptedTitle: t("accepted_title"),
    acceptedBody: t("accepted_body"),
    signinTitle: t("signin_title"),
    signinBody: t("signin_body"),
    signin: t("signin"),
    wrongAccountTitle: t("wrong_account_title"),
    wrongAccountBody: t("wrong_account_body"),
    invalidTitle: t("invalid_title"),
    invalidBody: t("invalid_body"),
  }

  return (
    <main className="wrap" style={{ maxWidth: 760, paddingTop: 88, paddingBottom: 140 }}>
      {"error" in preview ? (
        <>
          <h1 className="arco-section-title">{t(`error_${preview.error.status === "invalid" ? preview.error.reason : "not_found"}_title`)}</h1>
          <p className="arco-banner-body" style={{ marginTop: 12, maxWidth: "62ch" }}>
            {t(`error_${preview.error.status === "invalid" ? preview.error.reason : "not_found"}_body`)}
          </p>
        </>
      ) : (
        <>
          <p className="arco-eyebrow" style={{ marginBottom: 14 }}>{t("eyebrow")}</p>
          <h1 className="arco-section-title">
            {t("title", { project: preview.projectTitle ?? t("this_project") })}
          </h1>
          <p className="arco-banner-body" style={{ marginTop: 12, maxWidth: "62ch" }}>
            {preview.ownerCompanyName
              ? t("body_with_owner", {
                  owner: preview.ownerCompanyName,
                  company: preview.companyName ?? t("your_company"),
                })
              : t("body", { company: preview.companyName ?? t("your_company") })}
          </p>
          <AcceptClient token={token ?? ""} preview={preview} locale={locale} copy={copy} />
        </>
      )}
    </main>
  )
}
