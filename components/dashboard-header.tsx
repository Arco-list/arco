"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Menu, Search } from "lucide-react"
import { useState, useTransition, useEffect, useRef, type FormEvent } from "react"
import { toast } from "sonner"

import { useTranslations } from "next-intl"
import { signOutAction } from "@/app/(auth)/actions"
import { HeaderSearch } from "@/components/header-search"
import { CompanySwitcher } from "@/components/company-switcher"
import { useAuth } from "@/contexts/auth-context"
import { useCreateCompanyModal } from "@/contexts/create-company-modal-context"

export interface DashboardHeaderProps {
  maxWidth?: string;
}

export function DashboardHeader({ maxWidth = "max-w-[1800px]" }: DashboardHeaderProps = {}) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const searchParamQuery = searchParams.get("search") ?? ""
  const { profile, user } = useAuth()
  const { openCreateCompanyModal } = useCreateCompanyModal()
  const t = useTranslations("dashboard")
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSigningOut, startSignOutTransition] = useTransition()
  const menuRef = useRef<HTMLDivElement>(null)
  const [searchQuery, setSearchQuery] = useState(searchParamQuery)

  const isActive = (path: string) => {
    if (path === "/dashboard/listings") {
      return pathname === path || pathname.startsWith(`${path}/`) || pathname.startsWith("/dashboard/edit/")
    }
    return pathname === path || pathname.startsWith(`${path}/`)
  }
  const isHomeownerPage = pathname === "/homeowner"

  // Get user name from profile or session metadata
  const sessionMetadata = user?.user_metadata ?? {}
  const metadataFirstName =
    typeof sessionMetadata.first_name === "string"
      ? sessionMetadata.first_name
      : typeof sessionMetadata.firstName === "string"
        ? sessionMetadata.firstName
        : undefined
  const derivedFirstName = (profile?.first_name || metadataFirstName)?.toString().trim()
  const fallbackName = user?.email ? user.email.split("@")[0] : undefined
  const rawMenuLabel = derivedFirstName || fallbackName
  const menuLabel = rawMenuLabel && rawMenuLabel.trim().length > 0 ? rawMenuLabel.trim() : "Menu"
  const metadataUserTypes = Array.isArray(sessionMetadata.user_types)
    ? (sessionMetadata.user_types as string[])
    : typeof sessionMetadata.user_types === "string"
      ? [sessionMetadata.user_types]
      : null
  const userTypes = profile?.user_types ?? metadataUserTypes
  const isAdmin = userTypes?.includes("admin") ?? false
  const hasProfessionalRole = userTypes?.includes("professional") ?? false
  const canAccessProfessionalDashboard = isAdmin || hasProfessionalRole
  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!searchQuery.trim()) {
      return
    }

    router.push(`/projects?search=${encodeURIComponent(searchQuery.trim())}`)
    setIsMenuOpen(false)
  }

  const handleSignOut = () => {
    startSignOutTransition(async () => {
      const result = await signOutAction()

      if (result?.error) {
        toast.error(t("unable_to_sign_out"), { description: result.error.message })
        return
      }

      toast.success(t("signed_out"))
      setIsMenuOpen(false)
      window.location.href = "/"
    })
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    setSearchQuery(searchParamQuery)
  }, [searchParamQuery])

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border px-4 md:px-8 bg-white/95 backdrop-blur-md py-3 md:py-4">
      <div className={`mx-auto ${maxWidth}`}>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/" className="transition-opacity hover:opacity-80">
              <img
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Arco%20Logo%20Large%20%281%29-DDrzilvIhjI3lRfCVwKO1XpAs6LDc6.svg"
                alt="Arco Logo"
                className="h-4 w-auto"
              />
            </Link>

            {isHomeownerPage && (
              <div className="hidden items-center md:flex">
                <Link
                  href="/projects"
                  className={`text-sm font-medium px-3 py-1.5 rounded-full ${
                    pathname.startsWith("/projects")
                      ? "text-red-500"
                      : "text-black hover:bg-surface"
                  }`}
                >
                  {t("projects")}
                </Link>
                <Link
                  href="/professionals"
                  className={`text-sm font-medium px-3 py-1.5 rounded-full ${
                    pathname.startsWith("/professionals")
                      ? "text-red-500"
                      : "text-black hover:bg-surface"
                  }`}
                >
                  {t("professionals")}
                </Link>
              </div>
            )}
          </div>

          {!isHomeownerPage && canAccessProfessionalDashboard && (
            <div className="hidden md:flex items-center absolute left-1/2 -translate-x-1/2 gap-1">
              <CompanySwitcher />
              {isAdmin && (
                <Link
                  href="/admin"
                  className={`text-sm font-medium px-3 py-1.5 rounded-full ${
                    isActive("/admin")
                      ? "text-red-500"
                      : "text-black hover:bg-surface"
                  }`}
                >
                  {t("admin")}
                </Link>
              )}
              <Link
                href="/dashboard/listings"
                className={`text-sm font-medium px-3 py-1.5 rounded-full ${
                  isActive("/dashboard/listings")
                    ? "text-red-500"
                    : "text-black hover:bg-surface"
                }`}
              >
                {t("listings")}
              </Link>
              <Link
                href="/dashboard/company"
                className={`text-sm font-medium px-3 py-1.5 rounded-full ${
                  isActive("/dashboard/company")
                    ? "text-red-500"
                    : "text-black hover:bg-surface"
                }`}
              >
                {t("company")}
              </Link>
              <Link
                href="/dashboard/team"
                className={`text-sm font-medium px-3 py-1.5 rounded-full ${
                  isActive("/dashboard/team")
                    ? "text-red-500"
                    : "text-black hover:bg-surface"
                }`}
              >
                {t("team")}
              </Link>
              <Link
                href="/dashboard/inbox"
                className={`text-sm font-medium px-3 py-1.5 rounded-full ${
                  isActive("/dashboard/inbox")
                    ? "text-red-500"
                    : "text-black hover:bg-surface"
                }`}
              >
                {t("messages")}
              </Link>
              <Link
                href="/dashboard/pricing"
                className={`text-sm font-medium px-3 py-1.5 rounded-full ${
                  isActive("/dashboard/pricing")
                    ? "text-red-500"
                    : "text-black hover:bg-surface"
                }`}
              >
                {t("plans")}
              </Link>
            </div>
          )}

          {isHomeownerPage && (
            <HeaderSearch
              transparent={false}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onSearch={handleSearch}
              textColor="text-black"
            />
          )}

          <div className="relative flex items-center gap-3" ref={menuRef}>
            {isHomeownerPage && (
              <Link
                href={hasProfessionalRole ? "/new-project" : "/businesses/architects"}
                className="hidden md:block text-sm font-medium px-3 py-1.5 rounded-full text-black hover:bg-surface"
              >
                {hasProfessionalRole ? t("add_new_project") : t("list_with_us")}
              </Link>
            )}
            {!isHomeownerPage && canAccessProfessionalDashboard && (
              <Link
                href="/new-project"
                className="hidden md:block text-sm font-medium px-3 py-1.5 rounded-full text-black hover:bg-surface"
              >
                {t("add_new_project")}
              </Link>
            )}
            <button
              className="flex items-center gap-2 h-9 rounded-full border px-3 border-border hover:bg-surface"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <span className="hidden body-small md:inline">{menuLabel}</span>
              <Menu className="h-5 w-5" />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 top-12 z-50 w-56 rounded-md border border-border bg-white shadow-lg">
                <div className="py-1">
                  {isHomeownerPage ? (
                    <>
                      {/* Homeowner Dashboard Menu */}
                      {/* Section 1: Projects / Professionals */}
                      <div className="px-4 py-3">
                        <Link
                          href="/projects"
                          className="block text-sm text-foreground px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {t("projects")}
                        </Link>
                        <Link
                          href="/professionals"
                          className="block text-sm text-foreground px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {t("professionals")}
                        </Link>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-border" />

                      {/* Section 2: Messages + Saved items */}
                      <div className="px-4 py-3">
                        <Link
                          href="/homeowner?tab=messages"
                          className="block text-sm text-foreground px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {t("messages")}
                        </Link>
                        <Link
                          href="/homeowner?tab=saved-projects"
                          className="block text-sm text-foreground px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {t("saved_projects")}
                        </Link>
                        <Link
                          href="/homeowner?tab=saved-professionals"
                          className="block text-sm text-foreground px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {t("saved_professionals")}
                        </Link>
                        <Link
                          href="/homeowner?tab=account"
                          className="block text-sm text-foreground px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {t("account")}
                        </Link>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-border" />

                      {/* Section 3: List with us / Dashboard / Help */}
                      <div className="px-4 py-3">
                        <Link
                          href="/businesses/architects"
                          className="block text-sm text-foreground px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {t("list_with_us")}
                        </Link>
                        {canAccessProfessionalDashboard && (
                          <Link
                            href={isAdmin ? "/admin" : "/dashboard/listings"}
                            className="block text-sm text-foreground px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary"
                            onClick={() => setIsMenuOpen(false)}
                          >
                            {isAdmin ? t("admin") : t("switch_to_company")}
                          </Link>
                        )}
                        <Link
                          href="/help-center"
                          className="block text-sm text-foreground px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {t("help_center")}
                        </Link>
                        <button
                          type="button"
                          className="block w-full text-left text-sm text-red-600 px-3 py-1.5 rounded-full hover:bg-red-50"
                          onClick={handleSignOut}
                          disabled={isSigningOut}
                        >
                          {isSigningOut ? t("signing_out") : t("sign_out")}
                        </button>
                      </div>
                    </>
                  ) : canAccessProfessionalDashboard ? (
                    <>
                      {/* Professional Dashboard Menu */}
                      {/* Section 1: Listings, Company & Inbox */}
                      <div className="px-4 py-3">
                        <Link
                          href="/dashboard/listings"
                          className="block text-sm text-foreground px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {t("listings")}
                        </Link>
                        <Link
                          href="/dashboard/company"
                          className="block text-sm text-foreground px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {t("company")}
                        </Link>
                        <Link
                          href="/dashboard/team"
                          className="block text-sm text-foreground px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {t("team")}
                        </Link>
                        <Link
                          href="/dashboard/inbox"
                          className="block text-sm text-foreground px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {t("messages")}
                        </Link>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-border" />

                      {/* Section 2: Plans & Account */}
                      <div className="px-4 py-3">
                        <Link
                          href="/dashboard/pricing"
                          className="block text-sm text-foreground px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {t("plans")}
                        </Link>
                        <Link
                          href="/dashboard/settings"
                          className="block text-sm text-foreground px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {t("account")}
                        </Link>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-border" />

                      {/* Section 3: Help & Sign out */}
                      <div className="px-4 py-3">
                      <Link
                          href="/homeowner"
                          className="block text-sm text-foreground px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {t("switch_to_homeowner")}
                        </Link>
                        <Link
                          href="/help-center"
                          className="block text-sm text-foreground px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {t("help_center")}
                        </Link>
                        {isAdmin && (
                          <Link
                            href="/admin"
                            className="block text-sm text-foreground px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary"
                            onClick={() => setIsMenuOpen(false)}
                          >
                            {t("admin")}
                          </Link>
                        )}
                        <button
                          type="button"
                          className="block w-full text-left text-sm text-red-600 px-3 py-1.5 rounded-full hover:bg-red-50"
                          onClick={handleSignOut}
                          disabled={isSigningOut}
                        >
                          {isSigningOut ? t("signing_out") : t("sign_out")}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="px-4 py-3">
                        <button
                          type="button"
                          className="block text-sm text-foreground px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary text-left w-full"
                          onClick={() => { setIsMenuOpen(false); openCreateCompanyModal() }}
                        >
                          {t("create_company_profile")}
                        </button>
                        <Link
                          href="/homeowner"
                          className="block text-sm text-foreground px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {t("homeowner_dashboard")}
                        </Link>
                        <button
                          type="button"
                          className="block w-full text-left text-sm text-red-600 px-3 py-1.5 rounded-full hover:bg-red-50"
                          onClick={handleSignOut}
                          disabled={isSigningOut}
                        >
                          {isSigningOut ? t("signing_out") : t("sign_out")}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
