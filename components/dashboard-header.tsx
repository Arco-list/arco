"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Menu, Search } from "lucide-react"
import { useState, useTransition, useEffect, useRef, type FormEvent } from "react"
import { toast } from "sonner"

import { signOutAction } from "@/app/(auth)/actions"
import { HeaderSearch } from "@/components/header-search"
import { useAuth } from "@/contexts/auth-context"

export function DashboardHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const searchParamQuery = searchParams.get("search") ?? ""
  const { profile, user } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSigningOut, startSignOutTransition] = useTransition()
  const menuRef = useRef<HTMLDivElement>(null)
  const [searchQuery, setSearchQuery] = useState(searchParamQuery)

  const isActive = (path: string) => pathname === path || pathname.startsWith(`${path}/`)
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
    <header className="border-b border-gray-200 px-4 py-4 md:px-8">
      <div className="mx-auto max-w-7xl">
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
              <div className="hidden items-center space-x-6 md:flex">
                <Link
                  href="/projects"
                  className="text-sm font-medium text-black hover:text-gray-600 transition-colors"
                >
                  Projects
                </Link>
                <Link
                  href="/professionals"
                  className="text-sm font-medium text-black hover:text-gray-600 transition-colors"
                >
                  Professionals
                </Link>
              </div>
            )}
          </div>

          {!isHomeownerPage && canAccessProfessionalDashboard && (
            <div className="hidden items-center space-x-6 md:flex">
              {isAdmin && (
                <Link
                  href="/admin"
                  className={`text-sm font-medium transition-colors ${
                    isActive("/admin") 
                      ? "text-red-500 border-b-2 border-red-500 pb-1 hover:text-red-600" 
                      : "text-black hover:text-gray-600"
                  }`}
                >
                  Admin
                </Link>
              )}
              <Link
                href="/dashboard/listings"
                className={`text-sm font-medium transition-colors ${
                  isActive("/dashboard/listings") 
                    ? "text-red-500 border-b-2 border-red-500 pb-1 hover:text-red-600" 
                    : "text-black hover:text-gray-600"
                }`}
              >
                Listings
              </Link>
              <Link
                href="/dashboard/company"
                className={`text-sm font-medium transition-colors ${
                  isActive("/dashboard/company") 
                    ? "text-red-500 border-b-2 border-red-500 pb-1 hover:text-red-600" 
                    : "text-black hover:text-gray-600"
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

          <div className="relative flex items-center space-x-3" ref={menuRef}>
            {isHomeownerPage && (
              <Link
                href={hasProfessionalRole ? "/new-project" : "/list-with-us"}
                className="text-sm font-medium text-black hover:text-gray-600 transition-colors"
              >
                {hasProfessionalRole ? "Add new project" : "List with us"}
              </Link>
            )}
            {!isHomeownerPage && canAccessProfessionalDashboard && (
              <Link
                href="/new-project"
                className="text-sm font-medium text-black hover:text-gray-600 transition-colors"
              >
                Add new project
              </Link>
            )}
            <button
              className="flex items-center space-x-2 rounded-full border px-3 py-2 text-sm font-medium border-black text-black hover:bg-gray-100"
              aria-label="Open menu"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <span className="text-black">{menuLabel}</span>
              <Menu className="h-5 w-5" />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 top-12 z-50 w-56 rounded-md border border-gray-200 bg-white shadow-lg">
                <div className="py-1">
                  {isHomeownerPage ? (
                    <>
                      {/* Homeowner Dashboard Menu */}
                      <div className="border-t border-gray-100 px-4 py-3 md:hidden">
                        <form onSubmit={handleSearch} className="relative">
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Search projects..."
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                          />
                          <button
                            type="submit"
                            className="absolute right-2 top-1/2 -translate-y-1/2 transform text-gray-500 hover:text-gray-700"
                          >
                            <Search className="h-4 w-4" />
                          </button>
                        </form>
                      </div>
                      <Link
                        href="/projects"
                        className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Projects
                      </Link>
                      <div className="border-t border-gray-100"></div>
                      <Link
                        href="/professionals"
                        className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Professionals
                      </Link>
                      <div className="border-t border-gray-100"></div>
                      <Link
                        href="/list-with-us"
                        className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        List with us
                      </Link>
                      {canAccessProfessionalDashboard && (
                        <>
                          <div className="border-t border-gray-100"></div>
                          <Link
                            href={isAdmin ? "/admin" : "/dashboard/listings"}
                            className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            onClick={() => setIsMenuOpen(false)}
                          >
                            {isAdmin ? "Admin Dashboard" : "Professional Dashboard"}
                          </Link>
                        </>
                      )}
                      <div className="border-t border-gray-100"></div>
                      <Link
                        href="/homeowner?tab=saved-projects"
                        className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Saved Projects
                      </Link>
                      <div className="border-t border-gray-100"></div>
                      <Link
                        href="/homeowner?tab=saved-professionals"
                        className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Saved Professionals
                      </Link>
                      <div className="border-t border-gray-100"></div>
                      <Link
                        href="/homeowner?tab=settings"
                        className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Settings
                      </Link>
                    </>
                  ) : canAccessProfessionalDashboard ? (
                    <>
                      {/* Professional Dashboard Menu */}
                      {isAdmin && (
                        <>
                          <Link
                            href="/admin"
                            className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            onClick={() => setIsMenuOpen(false)}
                          >
                            Admin
                          </Link>
                          <div className="border-t border-gray-100"></div>
                        </>
                      )}
                      <Link
                        href="/homeowner"
                        className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Homeowner Dashboard
                      </Link>
                      <div className="border-t border-gray-100"></div>
                      <Link
                        href="/dashboard/listings"
                        className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Listings
                      </Link>
                      <div className="border-t border-gray-100"></div>
                      <Link
                        href="/dashboard/company"
                        className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Company
                      </Link>
                      <div className="border-t border-gray-100"></div>
                      <Link
                        href="/new-project"
                        className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Add Project
                      </Link>
                      <div className="border-t border-gray-100"></div>
                      <Link
                        href="/dashboard/pricing"
                        className="block w-full px-4 py-3 text-left text-sm text-red-500 font-medium hover:bg-red-50 transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Upgrade
                      </Link>
                      <div className="border-t border-gray-100"></div>
                      <Link
                        href="/dashboard/settings"
                        className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Settings
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/create-company"
                        className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Create company profile
                      </Link>
                      <div className="border-t border-gray-100"></div>
                      <Link
                        href="/homeowner"
                        className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Homeowner Dashboard
                      </Link>
                    </>
                  )}
                <div className="border-t border-gray-100"></div>
                <button
                  type="button"
                  className="block w-full px-4 py-3 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                >
                  {isSigningOut ? "Signing out..." : "Sign out"}
                </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
