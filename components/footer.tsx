"use client"

import Link from "next/link"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { LanguageSwitcher } from "@/components/language-switcher"

export function Footer() {
  const t = useTranslations("footer")
  const tn = useTranslations("nav")

  return (
    <>
      <style jsx global>{`
        .footer-top-grid { display: grid; grid-template-columns: 1.2fr 1.8fr; gap: 40px; padding-bottom: 40px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); margin-bottom: 28px; }
        .footer-links-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 48px; }
        .footer-col { display: flex; flex-direction: column; gap: 8px; }
        .footer-bottom-flex { display: flex; justify-content: space-between; align-items: center; }
        @media (max-width: 768px) {
          .footer-top-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
          .footer-links-grid { gap: 24px !important; }
          .footer-bottom-flex { gap: 12px; }
        }
        @media (max-width: 480px) { .footer-links-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      <footer className="bg-[#161614] text-white/50 py-12 pb-8">
        <div className="wrap">

          <div className="footer-top-grid">
            <div>
              <div className="mb-5">
                <Image src="/images/arco-logo-white.svg" alt="Arco" width={48} height={17} className="h-auto w-[48px]" />
              </div>
              <p className="arco-small-text text-white/35 max-w-[220px] leading-relaxed">
                {t("tagline")}
              </p>
            </div>

            <div className="footer-links-grid">
              <div className="footer-col">
                <h4 className="arco-eyebrow text-white/35 mb-1.5">{t("discover")}</h4>
                <Link href="/projects" className="arco-small-text text-white/50 hover:text-white transition-colors">{tn("projects")}</Link>
                <Link href="/professionals" className="arco-small-text text-white/50 hover:text-white transition-colors">{tn("professionals")}</Link>
              </div>

              <div className="footer-col">
                <h4 className="arco-eyebrow text-white/35 mb-1.5">{t("businesses")}</h4>
                <Link href="/businesses/architects" className="arco-small-text text-white/50 hover:text-white transition-colors">{tn("for_architects")}</Link>
                <Link href="/businesses/professionals" className="arco-small-text text-white/50 hover:text-white transition-colors">{tn("for_professionals")}</Link>
              </div>

              <div className="footer-col">
                <h4 className="arco-eyebrow text-white/35 mb-1.5">{t("company")}</h4>
                <Link href="/about" className="arco-small-text text-white/50 hover:text-white transition-colors">{t("about")}</Link>
                <Link href="/help-center" className="arco-small-text text-white/50 hover:text-white transition-colors">{t("help_faq")}</Link>
                <Link href="/privacy" className="arco-small-text text-white/50 hover:text-white transition-colors">{t("privacy")}</Link>
                <Link href="/terms" className="arco-small-text text-white/50 hover:text-white transition-colors">{t("terms")}</Link>
              </div>
            </div>
          </div>

          <div className="footer-bottom-flex">
            <span className="arco-small-text text-white/25">
              {t("copyright", { year: new Date().getFullYear() })}
            </span>
            <LanguageSwitcher />
          </div>

        </div>
      </footer>
    </>
  )
}
