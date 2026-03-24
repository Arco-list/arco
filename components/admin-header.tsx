"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useTransition, useEffect, useRef } from "react"
import { toast } from "sonner"

import { signOutAction } from "@/app/(auth)/actions"
import { useAuth } from "@/contexts/auth-context"

const NAV_ITEMS = [
  { title: "Users", href: "/admin/users", requiresSuperAdmin: true },
  { title: "Projects", href: "/admin/projects" },
  { title: "Companies", href: "/admin/professionals" },
  { title: "Categories", href: "/admin/categories" },
]

export function AdminHeader() {
  const pathname = usePathname()
  const { profile, user } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const [isSigningOut, startSignOutTransition] = useTransition()
  const menuRef = useRef<HTMLDivElement>(null)
  const accountMenuRef = useRef<HTMLDivElement>(null)

  const isSuperAdmin = profile?.admin_role === "super_admin"

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

  const userTypes = profile?.user_types ?? null
  const hasProfessionalRole = userTypes?.includes("professional") ?? false

  const visibleNavItems = NAV_ITEMS.filter((item) => (!item.requiresSuperAdmin || isSuperAdmin))

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(`${href}/`)
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
      setIsAccountMenuOpen(false)
      window.location.href = "/"
    })
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <header className="fixed top-0 left-0 right-0 z-[300] border-b border-[#e5e5e4] bg-white py-3 md:py-4">
      <div className="wrap">
        <div className="relative grid grid-cols-3 items-center gap-5">
          {/* Left: Hamburger + Nav Links */}
          <div className="relative flex items-center gap-6">
            <button
              className="flex flex-col gap-1 p-1 transition-opacity hover:opacity-70 text-black"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Menu"
            >
              <span className="block w-[18px] h-[1.5px] bg-black"></span>
              <span className="block w-[18px] h-[1.5px] bg-black"></span>
              <span className="block w-[18px] h-[1.5px] bg-black"></span>
            </button>

            {/* Hamburger Menu */}
            {isMenuOpen && (
              <div
                className="absolute z-50 w-52 border border-border bg-white shadow-lg"
                ref={menuRef}
                style={{ left: '0', top: 'calc(100% + 16px)' }}
              >
                <div className="py-1">
                  {/* ADMIN */}
                  <div className="px-4 py-3">
                    <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground px-3 pb-2">Admin</p>
                    {visibleNavItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`block arco-nav-text px-3 py-1.5 transition-colors ${
                          isActive(item.href) ? "text-primary" : "hover:text-primary"
                        }`}
                        onClick={() => setIsMenuOpen(false)}
                      >
                        {item.title}
                      </Link>
                    ))}
                  </div>

                  <div className="border-t border-border mx-4" />

                  {/* SWITCH */}
                  <div className="px-4 py-3">
                    <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground px-3 pb-2">Switch to</p>
                    {hasProfessionalRole && (
                      <Link href="/dashboard/listings" className="block arco-nav-text px-3 py-1.5 hover:text-primary transition-colors" onClick={() => setIsMenuOpen(false)}>Company</Link>
                    )}
                    <Link href="/homeowner" className="block arco-nav-text px-3 py-1.5 hover:text-primary transition-colors" onClick={() => setIsMenuOpen(false)}>Homeowner</Link>
                    <Link href="/" className="block arco-nav-text px-3 py-1.5 hover:text-primary transition-colors" onClick={() => setIsMenuOpen(false)}>Home</Link>
                  </div>

                  <div className="border-t border-border mx-4" />

                  {/* HELP */}
                  <div className="px-4 py-3">
                    <Link href="/help-center" className="block arco-nav-text px-3 py-1.5 hover:text-primary transition-colors" onClick={() => setIsMenuOpen(false)}>Help & FAQ</Link>
                  </div>
                </div>
              </div>
            )}

            {/* Desktop nav links after hamburger */}
            <div className="hidden items-center gap-6 md:flex">
              {visibleNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`arco-nav-text whitespace-nowrap ${
                    isActive(item.href) ? "text-primary" : "hover:text-primary"
                  }`}
                >
                  {item.title}
                </Link>
              ))}
            </div>
          </div>

          {/* Center: Logo */}
          <div className="flex justify-center">
            <Link href="/">
              <img
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Arco%20Logo%20Large%20%281%29-DDrzilvIhjI3lRfCVwKO1XpAs6LDc6.svg"
                alt="Arco"
                className="h-auto w-[60px] transition-all"
                style={{ filter: 'brightness(0)' }}
              />
            </Link>
          </div>

          {/* Right: Account button */}
          <div className="relative flex items-center justify-end">
            <div className="relative" ref={accountMenuRef}>
              <button
                type="button"
                onClick={() => setIsAccountMenuOpen((o) => !o)}
                className="arco-nav-text px-[18px] py-[7px] rounded-[3px] whitespace-nowrap btn-scrolled"
              >
                {menuLabel}
              </button>

              {isAccountMenuOpen && (
                <div
                  className="absolute right-0 z-50 w-52 border border-border bg-white shadow-lg"
                  style={{ top: 'calc(100% + 16px)' }}
                >
                  <div className="py-1">
                    {/* EXPLORE */}
                    <div className="px-4 py-3">
                      <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground px-3 pb-2">Explore</p>
                      <Link href="/homeowner?tab=saved-projects" className="block arco-nav-text px-3 py-1.5 hover:text-primary transition-colors" onClick={() => setIsAccountMenuOpen(false)}>Saved projects</Link>
                      <Link href="/homeowner?tab=saved-professionals" className="block arco-nav-text px-3 py-1.5 hover:text-primary transition-colors" onClick={() => setIsAccountMenuOpen(false)}>Saved professionals</Link>
                    </div>

                    {hasProfessionalRole && (
                      <>
                        <div className="border-t border-border mx-4" />
                        <div className="px-4 py-3">
                          <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground px-3 pb-2">Publish</p>
                          <Link href="/dashboard/listings" className="block arco-nav-text px-3 py-1.5 hover:text-primary transition-colors" onClick={() => setIsAccountMenuOpen(false)}>Listings</Link>
                          <Link href="/dashboard/company" className="block arco-nav-text px-3 py-1.5 hover:text-primary transition-colors" onClick={() => setIsAccountMenuOpen(false)}>Company</Link>
                          <Link href="/dashboard/team" className="block arco-nav-text px-3 py-1.5 hover:text-primary transition-colors" onClick={() => setIsAccountMenuOpen(false)}>Team</Link>
                        </div>
                      </>
                    )}

                    <div className="border-t border-border mx-4" />

                    {/* SETTINGS */}
                    <div className="px-4 py-3">
                      <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground px-3 pb-2">Settings</p>
                      <Link href="/homeowner?tab=account" className="block arco-nav-text px-3 py-1.5 hover:text-primary transition-colors" onClick={() => setIsAccountMenuOpen(false)}>Account</Link>
                      <button
                        type="button"
                        className="block w-full text-left arco-nav-text text-red-600 px-3 py-1.5 hover:bg-red-50 transition-colors"
                        onClick={handleSignOut}
                        disabled={isSigningOut}
                      >
                        {isSigningOut ? "Signing out..." : "Sign out"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
