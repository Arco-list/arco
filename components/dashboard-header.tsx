"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { useState } from "react"

export function DashboardHeader() {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const isActive = (path: string) => pathname === path

  return (
    <header className="border-b border-gray-200 px-4 py-4 md:px-8">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/" className="hover:opacity-80 transition-opacity">
          <img
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/design-mode-images/Arco%20Logo%20Large%20%281%29-aJeGJEgxeyF8NSayjRepsrq6ZTfTth.svg"
            alt="Arco Logo"
            className="h-6 w-auto"
          />
        </Link>

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

        <div className="flex items-center relative">
          <button
            className="flex items-center space-x-3 px-3 py-2 hover:bg-gray-100 rounded-full transition-colors border border-black"
            aria-label="Open menu"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <span className="text-sm font-medium text-black">John</span>
            <Menu className="h-5 w-5" />
          </button>

          {/* Mobile menu */}
          {isMenuOpen && (
            <div className="absolute right-0 top-16 z-50 w-48 rounded-md border border-gray-200 bg-white shadow-lg">
              <div className="py-1">
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
                  href="/dashboard/settings?tab=saved-projects"
                  className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Saved Projects
                </Link>
                <div className="border-t border-gray-100"></div>
                <Link
                  href="/dashboard/settings?tab=saved-professionals"
                  className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Saved Professionals
                </Link>
                <div className="border-t border-gray-100"></div>
                <Link
                  href="/dashboard/settings"
                  className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Settings
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
