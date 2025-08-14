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
    <header className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <img
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Arco%20Logo%20Large%20%281%29-DDrzilvIhjI3lRfCVwKO1XpAs6LDc6.svg"
                alt="Arco"
                className="h-6"
              />
            </Link>
          </div>

          {/* Center - Navigation menu */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link
              href="/dashboard/listings"
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                isActive("/dashboard/listings")
                  ? "text-black border-b-2 border-black"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Listings
            </Link>
            <Link
              href="/dashboard/company"
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                isActive("/dashboard/company")
                  ? "text-black border-b-2 border-black"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Company
            </Link>
          </nav>

          <div className="flex items-center space-x-4">
            <span className="text-gray-900 font-medium">John</span>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-4">
            <nav className="flex flex-col space-y-2">
              <Link
                href="/dashboard/listings"
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  isActive("/dashboard/listings") ? "text-black bg-gray-50" : "text-gray-600 hover:text-gray-900"
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                Listings
              </Link>
              <Link
                href="/dashboard/company"
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  isActive("/dashboard/company") ? "text-black bg-gray-50" : "text-gray-600 hover:text-gray-900"
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                Company
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
