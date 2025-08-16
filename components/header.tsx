"use client"
import { useState, useRef, useEffect } from "react"
import type React from "react"

import { Menu, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"

interface HeaderProps {
  transparent?: boolean
  isLoggedIn?: boolean
}

export function Header({ transparent = false, isLoggedIn = false }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const pathname = usePathname()

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/projects?search=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const headerClasses = transparent
    ? "absolute top-0 left-0 right-0 z-50 px-4 py-4 md:px-8"
    : "border-b border-gray-200 px-4 py-4 md:px-8"

  const textColor = transparent ? "text-white" : "text-black"
  const hoverColor = transparent ? "hover:text-gray-300" : "hover:text-gray-600"

  return (
    <header className={headerClasses}>
      <div className="max-w-7xl mx-auto">
        <div className="relative flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <img
                src={
                  transparent
                    ? "/images/arco-logo-white.svg"
                    : "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Arco%20Logo%20Large%20%281%29-DDrzilvIhjI3lRfCVwKO1XpAs6LDc6.svg"
                }
                alt="Arco Logo"
                className="h-6 w-auto"
              />
            </Link>

            <div className="hidden md:flex items-center space-x-6">
              {pathname !== "/projects" && pathname !== "/professionals" && (
                <Link href="/projects" className={`text-sm font-medium ${textColor} ${hoverColor} transition-colors`}>
                  Projects
                </Link>
              )}
              {pathname !== "/professionals" && pathname !== "/projects" && (
                <Link
                  href="/professionals"
                  className={`text-sm font-medium ${textColor} ${hoverColor} transition-colors`}
                >
                  Professionals
                </Link>
              )}
            </div>
          </div>

          <div className="hidden md:block absolute left-1/2 transform -translate-x-1/2 w-80">
            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full px-4 py-2 pr-10 border rounded-full ${
                  transparent
                    ? "bg-white/10 border-white/20 text-white placeholder-white/70 backdrop-blur-sm"
                    : "bg-white border-gray-300 text-black placeholder-gray-500"
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              <button
                type="submit"
                className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${textColor} hover:opacity-70`}
              >
                <Search className="h-4 w-4" />
              </button>
            </form>
          </div>

          <div className="relative flex items-center space-x-4" ref={menuRef}>
            {isLoggedIn ? (
              <>
                <Link
                  href="/new-project"
                  className={`text-sm font-medium ${textColor} ${hoverColor} transition-colors`}
                >
                  Add new project
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`flex items-center space-x-2 px-3 py-2 h-auto border rounded-full ${
                    transparent
                      ? "hover:bg-white/10 text-white hover:text-white border-white"
                      : "hover:bg-gray-100 text-black border-black"
                  }`}
                  aria-label="Open menu"
                  onClick={toggleMenu}
                >
                  <span className={`text-sm font-medium ${textColor}`}>Menu</span>
                  <Menu className="h-5 w-5" />
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className={`flex items-center space-x-2 px-3 py-2 h-auto border rounded-full ${
                  transparent
                    ? "hover:bg-white/10 text-white hover:text-white border-white"
                    : "hover:bg-gray-100 text-black border-black"
                }`}
                aria-label="Open menu"
                onClick={toggleMenu}
              >
                <span className={`text-sm font-medium ${textColor}`}>Login</span>
                <Menu className="h-5 w-5" />
              </Button>
            )}

            {isMenuOpen && (
              <div className="absolute right-0 top-12 z-50 w-48 rounded-md border border-gray-200 bg-white shadow-lg">
                <div className="py-1">
                  {pathname !== "/projects" && pathname !== "/professionals" && (
                    <>
                      <Link
                        href="/projects"
                        className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Projects
                      </Link>
                      <div className="border-t border-gray-100"></div>
                    </>
                  )}
                  {pathname !== "/professionals" && pathname !== "/projects" && (
                    <>
                      <Link
                        href="/professionals"
                        className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Professionals
                      </Link>
                      <div className="border-t border-gray-100"></div>
                    </>
                  )}
                  <div className="px-4 py-3 border-t border-gray-100 md:hidden">
                    <form onSubmit={handleSearch} className="relative">
                      <input
                        type="text"
                        placeholder="Search projects..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-3 py-2 pr-8 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="submit"
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        <Search className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                  {isLoggedIn ? (
                    <>
                      <Link
                        href="/new-project"
                        className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Add new project
                      </Link>
                      <div className="border-t border-gray-100"></div>
                      <Link
                        href="/login"
                        className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Login
                      </Link>
                      <div className="border-t border-gray-100"></div>
                      <Link
                        href="/signup"
                        className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Sign up
                      </Link>
                      <div className="border-t border-gray-100"></div>
                      <Link
                        href="/list-with-us"
                        className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        List with us
                      </Link>
                      <div className="border-t border-gray-100"></div>
                      <Link
                        href="/help-center"
                        className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Help center
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/login"
                        className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Login
                      </Link>
                      <div className="border-t border-gray-100"></div>
                      <Link
                        href="/signup"
                        className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Sign up
                      </Link>
                      <div className="border-t border-gray-100"></div>
                      <Link
                        href="/list-with-us"
                        className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        List with us
                      </Link>
                      <div className="border-t border-gray-100"></div>
                      <Link
                        href="/help-center"
                        className="block w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Help center
                      </Link>
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
