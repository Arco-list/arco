"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Menu, Search } from "lucide-react"
import { useState, useTransition, useEffect, useRef, type FormEvent } from "react"
import { toast } from "sonner"

import { signOutAction } from "@/app/(auth)/actions"
import { HeaderSearch } from "@/components/header-search"
import { useAuth } from "@/contexts/auth-context"

export interface DashboardHeaderProps {
  maxWidth?: string;
}

export function DashboardHeader({ maxWidth = "max-w-[1800px]" }: DashboardHeaderProps = {}) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const searchParamQuery = searchParams.get("search") ?? ""
  const { profile, user } = useAuth()
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
        toast.error("Unable to sign out", { description: result.error.message })
        return
      }

      toast.success("Signed out")
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
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-gray-200 px-4 md:px-8 bg-white/95 backdrop-blur-md py-3 md:py-4">
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
                      : "text-black hover:bg-gray-100"
                  }`}
                >
                  Projects
                </Link>
                <Link
                  href="/professionals"
                  className={`text-sm font-medium px-3 py-1.5 rounded-full ${
                    pathname.startsWith("/professionals")
                      ? "text-red-500"
                      : "text-black hover:bg-gray-100"
                  }`}
                >
                  Professionals
                </Link>
              </div>
            )}
          </div>

          {!isHomeownerPage && canAccessProfessionalDashboard && (
            <div className="hidden md:flex items-center absolute left-1/2 -translate-x-1/2">
              {isAdmin && (
                <Link
                  href="/admin"
                  className={`text-sm font-medium px-3 py-1.5 rounded-full ${
                    isActive("/admin")
                      ? "text-red-500"
                      : "text-black hover:bg-gray-100"
                  }`}
                >
                  Admin
                </Link>
              )}
              <Link
                href="/dashboard/listings"
                className={`text-sm font-medium px-3 py-1.5 rounded-full ${
                  isActive("/dashboard/listings")
                    ? "text-red-500"
                    : "text-black hover:bg-gray-100"
                }`}
              >
                Listings
              </Link>
              <Link
                href="/dashboard/company"
                className={`text-sm font-medium px-3 py-1.5 rounded-full ${
                  isActive("/dashboard/company")
                    ? "text-red-500"
                    : "text-black hover:bg-gray-100"
                }`}
              >
                Company
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
                href={hasProfessionalRole ? "/new-project" : "/list-with-us"}
                className="hidden md:block text-sm font-medium px-3 py-1.5 rounded-full text-black hover:bg-gray-100"
              >
                {hasProfessionalRole ? "Add new project" : "List with us"}
              </Link>
            )}
            {!isHomeownerPage && canAccessProfessionalDashboard && (
              <Link
                href="/new-project"
                className="hidden md:block text-sm font-medium px-3 py-1.5 rounded-full text-black hover:bg-gray-100"
              >
                Add new project
              </Link>
            )}
            <button
              className="flex items-center gap-2 h-9 rounded-full border px-3 border-gray-300 hover:bg-gray-100"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <span className="hidden text-sm md:inline">{menuLabel}</span>
              <Menu className="h-5 w-5" />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 top-12 z-50 w-56 rounded-md border border-gray-200 bg-white shadow-lg">
                <div className="py-1">
                  {isHomeownerPage ? (
                    <>
                      {/* Homeowner Dashboard Menu */}
                      {/* Section 1: Projects / Professionals */}
                      <div className="px-4 py-3">
                        <Link
                          href="/projects"
                          className="block text-sm text-gray-700 px-3 py-1.5 rounded-full hover:bg-gray-100 hover:text-gray-600"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          Projects
                        </Link>
                        <Link
                          href="/professionals"
                          className="block text-sm text-gray-700 px-3 py-1.5 rounded-full hover:bg-gray-100 hover:text-gray-600"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          Professionals
                        </Link>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-gray-100" />

                      {/* Section 2: Saved items */}
                      <div className="px-4 py-3">
                        <Link
                          href="/homeowner?tab=saved-projects"
                          className="block text-sm text-gray-700 px-3 py-1.5 rounded-full hover:bg-gray-100 hover:text-gray-600"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          Saved projects
                        </Link>
                        <Link
                          href="/homeowner?tab=saved-professionals"
                          className="block text-sm text-gray-700 px-3 py-1.5 rounded-full hover:bg-gray-100 hover:text-gray-600"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          Saved professionals
                        </Link>
                        <Link
                          href="/homeowner?tab=account"
                          className="block text-sm text-gray-700 px-3 py-1.5 rounded-full hover:bg-gray-100 hover:text-gray-600"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          Account
                        </Link>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-gray-100" />

                      {/* Section 3: List with us / Dashboard / Help */}
                      <div className="px-4 py-3">
                        <Link
                          href="/list-with-us"
                          className="block text-sm text-gray-700 px-3 py-1.5 rounded-full hover:bg-gray-100 hover:text-gray-600"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          List with us
                        </Link>
                        {canAccessProfessionalDashboard && (
                          <Link
                            href={isAdmin ? "/admin" : "/dashboard/listings"}
                            className="block text-sm text-gray-700 px-3 py-1.5 rounded-full hover:bg-gray-100 hover:text-gray-600"
                            onClick={() => setIsMenuOpen(false)}
                          >
                            {isAdmin ? "Admin" : "Switch to company"}
                          </Link>
                        )}
                        <Link
                          href="/help-center"
                          className="block text-sm text-gray-700 px-3 py-1.5 rounded-full hover:bg-gray-100 hover:text-gray-600"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          Help center
                        </Link>
                        <button
                          type="button"
                          className="block w-full text-left text-sm text-red-600 px-3 py-1.5 rounded-full hover:bg-red-50"
                          onClick={handleSignOut}
                          disabled={isSigningOut}
                        >
                          {isSigningOut ? "Signing out..." : "Sign out"}
                        </button>
                      </div>
                    </>
                  ) : canAccessProfessionalDashboard ? (
                    <>
                      {/* Professional Dashboard Menu */}
                      {/* Section 1: Listings & Company */}
                      <div className="px-4 py-3">
                        <Link
                          href="/dashboard/listings"
                          className="block text-sm text-gray-700 px-3 py-1.5 rounded-full hover:bg-gray-100 hover:text-gray-600"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          Listings
                        </Link>
                        <Link
                          href="/dashboard/company"
                          className="block text-sm text-gray-700 px-3 py-1.5 rounded-full hover:bg-gray-100 hover:text-gray-600"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          Company
                        </Link>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-gray-100" />

                      {/* Section 2: Upgrade plan & Billing - COMMENTED OUT */}
                      {/* <div className="px-4 py-3">
                        <Link
                          href="/dashboard/pricing"
                          className="block text-sm text-gray-700 px-3 py-1.5 rounded-full hover:bg-gray-100 hover:text-gray-600"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          Upgrade plan
                        </Link>
                        <Link
                          href="/dashboard/billing"
                          className="block text-sm text-gray-700 px-3 py-1.5 rounded-full hover:bg-gray-100 hover:text-gray-600"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          Billing
                        </Link>
                      </div> */}

                      {/* Divider */}
                      {/* <div className="border-t border-gray-100" /> */}

                      {/* Section 2: Account */}
                      <div className="px-4 py-3">
                        <Link
                          href="/dashboard/settings"
                          className="block text-sm text-gray-700 px-3 py-1.5 rounded-full hover:bg-gray-100 hover:text-gray-600"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          Account
                        </Link>

                      </div>

                      {/* Divider */}
                      <div className="border-t border-gray-100" />

                      {/* Section 3: Help & Sign out */}
                      <div className="px-4 py-3">
                      <Link
                          href="/homeowner"
                          className="block text-sm text-gray-700 px-3 py-1.5 rounded-full hover:bg-gray-100 hover:text-gray-600"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          Switch to homeowner
                        </Link>
                        <Link
                          href="/help-center"
                          className="block text-sm text-gray-700 px-3 py-1.5 rounded-full hover:bg-gray-100 hover:text-gray-600"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          Help center
                        </Link>
                        {isAdmin && (
                          <Link
                            href="/admin"
                            className="block text-sm text-gray-700 px-3 py-1.5 rounded-full hover:bg-gray-100 hover:text-gray-600"
                            onClick={() => setIsMenuOpen(false)}
                          >
                            Admin
                          </Link>
                        )}
                        <button
                          type="button"
                          className="block w-full text-left text-sm text-red-600 px-3 py-1.5 rounded-full hover:bg-red-50"
                          onClick={handleSignOut}
                          disabled={isSigningOut}
                        >
                          {isSigningOut ? "Signing out..." : "Sign out"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="px-4 py-3">
                        <Link
                          href="/create-company"
                          className="block text-sm text-gray-700 px-3 py-1.5 rounded-full hover:bg-gray-100 hover:text-gray-600"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          Create company profile
                        </Link>
                        <Link
                          href="/homeowner"
                          className="block text-sm text-gray-700 px-3 py-1.5 rounded-full hover:bg-gray-100 hover:text-gray-600"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          Homeowner Dashboard
                        </Link>
                        <button
                          type="button"
                          className="block w-full text-left text-sm text-red-600 px-3 py-1.5 rounded-full hover:bg-red-50"
                          onClick={handleSignOut}
                          disabled={isSigningOut}
                        >
                          {isSigningOut ? "Signing out..." : "Sign out"}
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
