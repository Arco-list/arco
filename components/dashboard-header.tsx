"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { useState, useTransition, useEffect, useRef } from "react"
import { toast } from "sonner"

import { signOutAction } from "@/app/(auth)/actions"
import { useAuth } from "@/contexts/auth-context"

export function DashboardHeader() {
  const pathname = usePathname()
  const { session, profile } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSigningOut, startSignOutTransition] = useTransition()
  const menuRef = useRef<HTMLDivElement>(null)

  const isActive = (path: string) => pathname === path
  const isHomeownerPage = pathname === "/homeowner"

  // Get user name from profile or session metadata
  const sessionMetadata = session?.user?.user_metadata ?? {}
  const metadataFirstName =
    typeof sessionMetadata.first_name === "string"
      ? sessionMetadata.first_name
      : typeof sessionMetadata.firstName === "string"
        ? sessionMetadata.firstName
        : undefined
  const derivedFirstName = (profile?.first_name || metadataFirstName)?.toString().trim()
  const fallbackName = session?.user?.email ? session.user.email.split("@")[0] : undefined
  const rawMenuLabel = derivedFirstName || fallbackName
  const menuLabel = rawMenuLabel && rawMenuLabel.trim().length > 0 ? rawMenuLabel.trim() : "Menu"

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

  return (
    <header className="border-b border-gray-200 px-4 py-4 md:px-8">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/" className="hover:opacity-80 transition-opacity">
          <img
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Arco%20Logo%20Large%20%281%29-DDrzilvIhjI3lRfCVwKO1XpAs6LDc6.svg"
            alt="Arco Logo"
            className="h-6 w-auto"
          />
        </Link>

        {!isHomeownerPage && (
          <nav className="hidden md:flex items-center space-x-8">
            <Link
              href="/dashboard/listings"
              className={`text-sm font-medium transition-colors hover:text-gray-600 ${
                isActive("/dashboard/listings") ? "text-black border-b-2 border-black pb-1" : "text-gray-700"
              }`}
            >
              Listings
            </Link>
            <Link
              href="/dashboard/company"
              className={`text-sm font-medium transition-colors hover:text-gray-600 ${
                isActive("/dashboard/company") ? "text-black border-b-2 border-black pb-1" : "text-gray-700"
              }`}
            >
              Company
            </Link>
          </nav>
        )}

        <div className="flex items-center relative" ref={menuRef}>
          <button
            className="flex items-center space-x-3 px-3 py-2 hover:bg-gray-100 rounded-full transition-colors border border-black"
            aria-label="Open menu"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <span className="text-sm font-medium text-black">{menuLabel}</span>
            <Menu className="h-5 w-5" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-16 z-50 w-56 rounded-md border border-gray-200 bg-white shadow-lg">
              <div className="py-1">
                {isHomeownerPage ? (
                  <>
                    {/* Homeowner Dashboard Menu */}
                    <Link
                      href="/dashboard/listings"
                      className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Professional Dashboard
                    </Link>
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
                ) : (
                  <>
                    {/* Professional Dashboard Menu */}
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
                      href="/dashboard/settings"
                      className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Settings
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
    </header>
  )
}
